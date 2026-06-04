#!/bin/bash

# Local Testing Script for MP3 Conversion Service

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# ============================================================================
# Configuration
# ============================================================================

SERVICE_URL="${1:-http://localhost:8080}"
TEST_AUDIO_FILE="${2:-test-audio.webm}"

# ============================================================================
# Functions
# ============================================================================

print_header() {
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

# ============================================================================
# Tests
# ============================================================================

print_header "MP3 Conversion Service Test Suite"

echo "Service URL: $SERVICE_URL"
echo "Test audio file: $TEST_AUDIO_FILE"
echo ""

# Test 1: Health Check
print_header "Test 1: Health Check"
echo "Sending GET /health..."
HEALTH_RESPONSE=$(curl -s "$SERVICE_URL/health")
echo "Response: $HEALTH_RESPONSE"

if echo "$HEALTH_RESPONSE" | grep -q "healthy"; then
    print_success "Service is healthy"
else
    print_error "Health check failed"
    exit 1
fi

# Test 2: Create test audio file if it doesn't exist
print_header "Test 2: Prepare Test Audio"

if [ ! -f "$TEST_AUDIO_FILE" ]; then
    echo "Test audio file not found. Downloading sample WebM audio..."
    
    # Create a minimal WebM file for testing (requires ffmpeg)
    if command -v ffmpeg &> /dev/null; then
        echo "Generating test WebM audio (5 seconds of silence)..."
        ffmpeg -f lavfi -i anullsrc=r=48000:cl=mono -t 5 -q:a 9 -acodec libopus "$TEST_AUDIO_FILE" -y 2>/dev/null
        print_success "Test audio generated: $TEST_AUDIO_FILE"
    else
        print_error "ffmpeg not found and test file doesn't exist"
        print_error "Please provide a WebM audio file or install ffmpeg"
        exit 1
    fi
else
    print_success "Test audio file exists: $TEST_AUDIO_FILE"
fi

# Test 3: Audio conversion
print_header "Test 3: Audio Conversion"

# Check file size
FILE_SIZE=$(stat -f%z "$TEST_AUDIO_FILE" 2>/dev/null || stat -c%s "$TEST_AUDIO_FILE" 2>/dev/null)
echo "Test file size: $FILE_SIZE bytes"

# Encode to base64
echo "Encoding audio to base64..."
AUDIO_BASE64=$(base64 < "$TEST_AUDIO_FILE" | tr -d '\n')
echo "Base64 length: ${#AUDIO_BASE64} characters"

# Prepare JSON request
JSON_REQUEST=$(cat <<EOF
{
  "audio_base64": "$AUDIO_BASE64",
  "filename": "$TEST_AUDIO_FILE",
  "candidate_name": "Test_Candidate",
  "interview_id": "INT-TEST-001"
}
EOF
)

echo ""
echo "Sending conversion request..."
RESPONSE=$(curl -s -X POST \
    -H "Content-Type: application/json" \
    -d "$JSON_REQUEST" \
    "$SERVICE_URL/convert-audio")

echo "Response:"
echo "$RESPONSE" | jq . 2>/dev/null || echo "$RESPONSE"

# Parse response
if echo "$RESPONSE" | grep -q '"success":true'; then
    print_success "Conversion successful"
    
    # Extract MP3 and save
    MP3_BASE64=$(echo "$RESPONSE" | jq -r '.mp3_base64')
    OUTPUT_FILE="test-output.mp3"
    
    echo "Decoding MP3..."
    echo "$MP3_BASE64" | base64 -d > "$OUTPUT_FILE"
    
    OUTPUT_SIZE=$(stat -f%z "$OUTPUT_FILE" 2>/dev/null || stat -c%s "$OUTPUT_FILE" 2>/dev/null)
    print_success "MP3 saved: $OUTPUT_FILE ($OUTPUT_SIZE bytes)"
    
    # Get metadata
    DURATION=$(echo "$RESPONSE" | jq -r '.duration_seconds // "unknown"')
    CONVERSION_TIME=$(echo "$RESPONSE" | jq -r '.conversion_time_seconds // "unknown"')
    
    echo "Duration: $DURATION seconds"
    echo "Conversion time: $CONVERSION_TIME seconds"
    
    # Test 4: Verify MP3 with ffprobe
    print_header "Test 4: MP3 Verification"
    if command -v ffprobe &> /dev/null; then
        echo "Verifying MP3 with ffprobe..."
        FFPROBE_OUTPUT=$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$OUTPUT_FILE")
        print_success "MP3 is valid. Duration: $FFPROBE_OUTPUT seconds"
    else
        echo "ffprobe not available, skipping verification"
    fi
    
else
    ERROR=$(echo "$RESPONSE" | jq -r '.error // "unknown error"')
    print_error "Conversion failed: $ERROR"
    exit 1
fi

# Test 5: Performance test
print_header "Test 5: Performance Test"
echo "Testing conversion speed..."

START_TIME=$(date +%s%N)
RESPONSE=$(curl -s -X POST \
    -H "Content-Type: application/json" \
    -d "$JSON_REQUEST" \
    "$SERVICE_URL/convert-audio")
END_TIME=$(date +%s%N)

ELAPSED=$(echo "scale=3; ($END_TIME - $START_TIME) / 1000000" | bc)
echo "Conversion time: ${ELAPSED}ms"

if (( $(echo "$ELAPSED < 60000" | bc -l) )); then
    print_success "Performance is acceptable (< 60 seconds)"
else
    print_error "Performance is slow (> 60 seconds)"
fi

# ============================================================================
# Cleanup
# ============================================================================

print_header "Test Complete"
print_success "All tests passed!"
echo ""
echo "Generated files:"
echo "  - $TEST_AUDIO_FILE (test audio)"
echo "  - $OUTPUT_FILE (converted MP3)"
echo ""
echo "To test playback:"
echo "  - macOS: open $OUTPUT_FILE"
echo "  - Linux: vlc $OUTPUT_FILE"
echo "  - Windows: start $OUTPUT_FILE"
