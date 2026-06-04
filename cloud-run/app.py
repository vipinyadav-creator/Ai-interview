#!/usr/bin/env python3
"""
FastAPI service for converting WebM/Opus audio to MP3 using FFmpeg.
Runs on Google Cloud Run.

API Endpoints:
  POST /convert-audio - Convert WebM/Opus to MP3
  GET /health - Health check
"""

import os
import sys
import base64
import subprocess
import tempfile
import logging
from pathlib import Path
from typing import Optional
from datetime import datetime

from fastapi import FastAPI, HTTPException, Request
from pydantic import BaseModel
import uvicorn

# ============================================================================
# Configuration
# ============================================================================

MAX_FILE_SIZE = 500 * 1024 * 1024  # 500 MB
CONVERSION_TIMEOUT = 300  # 5 minutes
TEMP_DIR = "/tmp/audio-convert"

# Create temp directory
Path(TEMP_DIR).mkdir(exist_ok=True)

# Logging setup
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ============================================================================
# FastAPI App
# ============================================================================

app = FastAPI(
    title="MP3 Conversion Service",
    version="1.0.0",
    description="Convert WebM/Opus audio to MP3 using FFmpeg"
)

# ============================================================================
# Request/Response Models
# ============================================================================

class ConversionRequest(BaseModel):
    """Request to convert audio to MP3"""
    audio_base64: str  # Base64-encoded WebM/Opus file
    filename: str  # Original filename (for logging)
    candidate_name: str  # Candidate name (for logging)
    interview_id: str  # Interview ID (for logging)


class ConversionResponse(BaseModel):
    """Response with converted MP3"""
    success: bool
    mp3_base64: Optional[str] = None  # Base64-encoded MP3 file
    filename: str = ""  # Output filename with .mp3 extension
    mime_type: str = "audio/mpeg"
    error: Optional[str] = None
    duration_seconds: Optional[float] = None
    input_size_bytes: int = 0
    output_size_bytes: int = 0
    conversion_time_seconds: Optional[float] = None


# ============================================================================
# Helper Functions
# ============================================================================

def validate_webm_header(file_path: str) -> bool:
    """
    Verify that the file has a valid WebM header.
    WebM files start with EBML identifier: 0x1A 0x45 0xDF 0xA3
    """
    try:
        with open(file_path, 'rb') as f:
            header = f.read(4)
            # WebM EBML header
            if header[:4] == b'\x1a\x45\xdf\xa3':
                return True
            # Fallback: OGG format (Opus can also be in OGG container)
            if header[:4] == b'OggS':
                return True
            logger.warning(f"Unknown audio header: {header.hex()}")
            return False
    except Exception as e:
        logger.error(f"Error validating WebM header: {e}")
        return False


def get_audio_duration(file_path: str) -> Optional[float]:
    """
    Get duration of audio file using ffprobe.
    Returns duration in seconds, or None if unable to determine.
    """
    try:
        result = subprocess.run(
            [
                'ffprobe',
                '-v', 'error',
                '-show_entries', 'format=duration',
                '-of', 'default=noprint_wrappers=1:nokey=1:nokey_sep=:',
                file_path
            ],
            capture_output=True,
            text=True,
            timeout=10
        )
        if result.returncode == 0:
            return float(result.stdout.strip())
    except Exception as e:
        logger.error(f"Error getting audio duration: {e}")
    return None


def convert_webm_to_mp3(
    input_path: str,
    output_path: str,
    bitrate: str = "192k"
) -> bool:
    """
    Convert WebM/Opus audio to MP3 using FFmpeg.
    
    Args:
        input_path: Path to WebM/Opus file
        output_path: Path for output MP3 file
        bitrate: Output bitrate (default: 192k)
    
    Returns:
        True if conversion successful, False otherwise
    """
    try:
        cmd = [
            'ffmpeg',
            '-i', input_path,           # Input file
            '-q:a', '9',               # Quality level 9 (128-320 kbps variable)
            '-acodec', 'libmp3lame',   # MP3 encoder
            '-ab', bitrate,            # Bitrate
            '-y',                      # Overwrite output file
            output_path                # Output file
        ]
        
        logger.info(f"Running FFmpeg: {' '.join(cmd)}")
        
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=CONVERSION_TIMEOUT
        )
        
        if result.returncode != 0:
            error_msg = result.stderr or "Unknown FFmpeg error"
            logger.error(f"FFmpeg conversion failed: {error_msg}")
            return False
        
        logger.info(f"FFmpeg conversion successful: {output_path}")
        return True
        
    except subprocess.TimeoutExpired:
        logger.error(f"FFmpeg conversion timeout (>{CONVERSION_TIMEOUT}s)")
        return False
    except Exception as e:
        logger.error(f"FFmpeg conversion error: {e}")
        return False


def verify_mp3_integrity(file_path: str) -> bool:
    """
    Verify that the output file is a valid MP3 using ffprobe.
    """
    try:
        result = subprocess.run(
            [
                'ffprobe',
                '-v', 'error',
                '-select_streams', 'a:0',
                '-show_entries', 'stream=codec_type,codec_name',
                '-of', 'default=noprint_wrappers=1:nokey=1:nokey_sep=:',
                file_path
            ],
            capture_output=True,
            text=True,
            timeout=10
        )
        
        if result.returncode != 0:
            logger.error(f"ffprobe verification failed: {result.stderr}")
            return False
        
        output = result.stdout.strip()
        logger.info(f"ffprobe output: {output}")
        
        # Should contain "audio" and "mp3" or similar
        if 'audio' in output and 'mp3' in output:
            logger.info("MP3 integrity verified")
            return True
        
        logger.warning(f"Unexpected codec in output: {output}")
        return False
        
    except subprocess.TimeoutExpired:
        logger.error("ffprobe verification timeout")
        return False
    except Exception as e:
        logger.error(f"MP3 integrity check error: {e}")
        return False


# ============================================================================
# Routes
# ============================================================================

@app.get("/health")
async def health_check():
    """Health check endpoint for Cloud Run"""
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "service": "mp3-conversion"
    }


@app.post("/convert-audio", response_model=ConversionResponse)
async def convert_audio(request: ConversionRequest) -> ConversionResponse:
    """
    Convert WebM/Opus audio to MP3.
    
    Request:
        audio_base64: Base64-encoded WebM/Opus file
        filename: Original filename
        candidate_name: Candidate name
        interview_id: Interview ID
    
    Response:
        mp3_base64: Base64-encoded MP3 file
        filename: Output filename with .mp3 extension
        mime_type: audio/mpeg
        duration_seconds: Duration of audio
        conversion_time_seconds: Time taken for conversion
    """
    import time
    start_time = time.time()
    
    try:
        # Validate input
        logger.info(f"Conversion request: {request.candidate_name} ({request.interview_id})")
        
        if not request.audio_base64:
            raise HTTPException(status_code=400, detail="No audio data provided")
        
        # Decode base64
        try:
            audio_data = base64.b64decode(request.audio_base64)
        except Exception as e:
            logger.error(f"Base64 decode error: {e}")
            raise HTTPException(status_code=400, detail="Invalid base64 encoding")
        
        # Check file size
        input_size = len(audio_data)
        if input_size > MAX_FILE_SIZE:
            logger.error(f"File too large: {input_size} > {MAX_FILE_SIZE}")
            raise HTTPException(
                status_code=413,
                detail=f"File too large: {input_size} bytes > {MAX_FILE_SIZE} bytes"
            )
        
        # Create temp files
        timestamp = int(time.time() * 1000)
        input_path = f"{TEMP_DIR}/input_{timestamp}.webm"
        output_path = f"{TEMP_DIR}/output_{timestamp}.mp3"
        
        try:
            # Write input file
            with open(input_path, 'wb') as f:
                f.write(audio_data)
            logger.info(f"Input file written: {input_path} ({input_size} bytes)")
            
            # Validate input file
            if not validate_webm_header(input_path):
                logger.warning("WebM header validation failed, but continuing with conversion")
            
            # Convert to MP3
            if not convert_webm_to_mp3(input_path, output_path):
                raise HTTPException(
                    status_code=500,
                    detail="FFmpeg conversion failed"
                )
            
            # Verify output file exists
            if not os.path.exists(output_path):
                raise HTTPException(
                    status_code=500,
                    detail="Output file not created"
                )
            
            output_size = os.path.getsize(output_path)
            logger.info(f"Output file created: {output_path} ({output_size} bytes)")
            
            # Verify MP3 integrity
            if not verify_mp3_integrity(output_path):
                logger.warning("MP3 integrity check failed, but continuing")
            
            # Get audio duration
            duration = get_audio_duration(output_path)
            
            # Read MP3 file
            with open(output_path, 'rb') as f:
                mp3_data = f.read()
            
            # Encode to base64
            mp3_base64 = base64.b64encode(mp3_data).decode('utf-8')
            
            # Generate output filename
            output_filename = f"{request.candidate_name.replace(' ', '_')}_{request.interview_id}.mp3"
            
            conversion_time = time.time() - start_time
            logger.info(
                f"Conversion complete: {input_size} bytes → {output_size} bytes "
                f"in {conversion_time:.2f}s ({request.interview_id})"
            )
            
            return ConversionResponse(
                success=True,
                mp3_base64=mp3_base64,
                filename=output_filename,
                mime_type="audio/mpeg",
                duration_seconds=duration,
                input_size_bytes=input_size,
                output_size_bytes=output_size,
                conversion_time_seconds=conversion_time
            )
            
        finally:
            # Cleanup temp files
            try:
                if os.path.exists(input_path):
                    os.remove(input_path)
                    logger.info(f"Cleaned up input: {input_path}")
            except Exception as e:
                logger.error(f"Error deleting input file: {e}")
            
            try:
                if os.path.exists(output_path):
                    os.remove(output_path)
                    logger.info(f"Cleaned up output: {output_path}")
            except Exception as e:
                logger.error(f"Error deleting output file: {e}")
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@app.post("/batch-convert")
async def batch_convert(requests_list: list[ConversionRequest]):
    """
    Batch convert multiple audio files.
    Not recommended for production (might timeout).
    Better to call /convert-audio multiple times.
    """
    results = []
    for req in requests_list:
        result = await convert_audio(req)
        results.append(result)
    return {"conversions": results}


# ============================================================================
# Main
# ============================================================================

if __name__ == "__main__":
    # Get port from environment (Cloud Run sets PORT=8080)
    port = int(os.environ.get("PORT", 8080))
    
    logger.info(f"Starting MP3 Conversion Service on port {port}")
    logger.info(f"FFmpeg version: {subprocess.run(['ffmpeg', '-version'], capture_output=True, text=True).stdout.split(chr(10))[0]}")
    logger.info(f"ffprobe version: {subprocess.run(['ffprobe', '-version'], capture_output=True, text=True).stdout.split(chr(10))[0]}")
    
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=port,
        log_level="info"
    )
