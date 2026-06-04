# Stage 1: Build dependencies
FROM python:3.11-slim AS base

# Install FFmpeg and dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    libsm6 \
    libxext6 \
    libxrender-dev \
    && rm -rf /var/lib/apt/lists/*

# Verify FFmpeg installation
RUN ffmpeg -version && ffprobe -version

# Set working directory
WORKDIR /app

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY app.py .

# Stage 2: Runtime (optional, for smaller image)
FROM base

# Set metadata
LABEL maintainer="AI Interview Team"
LABEL description="MP3 Conversion Service using FastAPI and FFmpeg"

# Create non-root user for security
RUN useradd -m -u 1000 appuser && \
    mkdir -p /tmp/audio-convert && \
    chown -R appuser:appuser /tmp/audio-convert /app

USER appuser

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8080/health').read()" || exit 1

# Start the application
CMD ["python", "-u", "app.py"]
