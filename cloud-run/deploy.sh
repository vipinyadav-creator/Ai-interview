#!/bin/bash

# Google Cloud Run MP3 Conversion Service - Deployment Script
# This script builds and deploys the MP3 conversion service to Google Cloud Run

set -e

# ============================================================================
# Configuration
# ============================================================================

PROJECT_ID="${GCP_PROJECT_ID:-}"
SERVICE_NAME="mp3-conversion"
REGION="us-central1"
IMAGE_NAME="gcr.io/${PROJECT_ID}/${SERVICE_NAME}"
MEMORY="2Gi"
CPU="2"
TIMEOUT="600"
CONCURRENCY="100"

# ============================================================================
# Functions
# ============================================================================

print_usage() {
    cat <<EOF
Usage: ./deploy.sh [OPTIONS]

Options:
    --project-id ID      Google Cloud Project ID (required)
    --service-name NAME  Service name (default: mp3-conversion)
    --region REGION      GCP region (default: us-central1)
    --memory SIZE        Memory allocation (default: 2Gi)
    --cpu CPU            CPU allocation (default: 2)
    --build-only         Build image without deploying
    --local              Run service locally on port 8080
    -h, --help           Show this help message

Examples:
    ./deploy.sh --project-id my-project
    ./deploy.sh --project-id my-project --region us-west1 --build-only
    ./deploy.sh --local
EOF
}

log() {
    echo "✓ $1"
}

error() {
    echo "✗ $1" >&2
    exit 1
}

# ============================================================================
# Parse Arguments
# ============================================================================

BUILD_ONLY=false
LOCAL=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --project-id)
            PROJECT_ID="$2"
            shift 2
            ;;
        --service-name)
            SERVICE_NAME="$2"
            shift 2
            ;;
        --region)
            REGION="$2"
            shift 2
            ;;
        --memory)
            MEMORY="$2"
            shift 2
            ;;
        --cpu)
            CPU="$2"
            shift 2
            ;;
        --build-only)
            BUILD_ONLY=true
            shift
            ;;
        --local)
            LOCAL=true
            shift
            ;;
        -h|--help)
            print_usage
            exit 0
            ;;
        *)
            error "Unknown option: $1"
            ;;
    esac
done

# ============================================================================
# Validation
# ============================================================================

if [ "$LOCAL" = false ] && [ -z "$PROJECT_ID" ]; then
    error "Project ID is required. Use --project-id or set GCP_PROJECT_ID environment variable"
fi

# ============================================================================
# Local Development
# ============================================================================

if [ "$LOCAL" = true ]; then
    log "Starting local MP3 conversion service on port 8080..."
    
    # Check if Docker is available
    if ! command -v docker &> /dev/null; then
        log "Docker not found. Running with local Python..."
        pip install -r requirements.txt
        python app.py
    else
        log "Building Docker image locally..."
        docker build -t mp3-conversion:local .
        log "Running Docker container..."
        docker run -it --rm \
            -p 8080:8080 \
            -v "$(pwd):/app" \
            mp3-conversion:local
    fi
    exit 0
fi

# ============================================================================
# Cloud Deployment
# ============================================================================

IMAGE_NAME="gcr.io/${PROJECT_ID}/${SERVICE_NAME}"

log "MP3 Conversion Service Deployment"
log "Project: $PROJECT_ID"
log "Service: $SERVICE_NAME"
log "Region: $REGION"
log "Image: $IMAGE_NAME"
log "Memory: $MEMORY"
log "CPU: $CPU"

# Verify gcloud is installed
if ! command -v gcloud &> /dev/null; then
    error "gcloud CLI not found. Install from: https://cloud.google.com/sdk/docs/install"
fi

# Set GCP project
log "Setting GCP project to $PROJECT_ID..."
gcloud config set project "$PROJECT_ID"

# Enable required APIs
log "Enabling required APIs..."
gcloud services enable \
    run.googleapis.com \
    cloudbuild.googleapis.com \
    containerregistry.googleapis.com \
    --quiet

# Build image
log "Building Docker image..."
gcloud builds submit \
    --tag "$IMAGE_NAME" \
    --project "$PROJECT_ID" \
    --quiet \
    .

if [ "$BUILD_ONLY" = true ]; then
    log "Build complete! Image: $IMAGE_NAME"
    log "To deploy, run: gcloud run deploy $SERVICE_NAME --image $IMAGE_NAME"
    exit 0
fi

# Deploy to Cloud Run
log "Deploying to Google Cloud Run..."
gcloud run deploy "$SERVICE_NAME" \
    --image "$IMAGE_NAME" \
    --region "$REGION" \
    --platform managed \
    --memory "$MEMORY" \
    --cpu "$CPU" \
    --timeout "$TIMEOUT" \
    --concurrency "$CONCURRENCY" \
    --allow-unauthenticated \
    --set-env-vars "LOG_LEVEL=INFO" \
    --no-gen2 \
    --quiet

# Get service URL
SERVICE_URL=$(gcloud run services describe "$SERVICE_NAME" \
    --region "$REGION" \
    --format 'value(status.url)')

log "Deployment complete!"
log "Service URL: $SERVICE_URL"
log ""
log "Next steps:"
log "1. Test the service: curl $SERVICE_URL/health"
log "2. Update React frontend with: VITE_MP3_SERVICE_URL=$SERVICE_URL"
log "3. Update Google Apps Script with the service URL"
log ""
log "Deployment commands saved to: deployment-commands.txt"

# Save deployment info
cat > deployment-commands.txt <<EOF
# MP3 Conversion Service Deployment Information

Service Name: $SERVICE_NAME
Project ID: $PROJECT_ID
Region: $REGION
Service URL: $SERVICE_URL
Image: $IMAGE_NAME

## Health Check
curl $SERVICE_URL/health

## Environment Variables (for React)
export VITE_MP3_SERVICE_URL=$SERVICE_URL

## Environment Variables (for Apps Script)
MP3_SERVICE_URL: $SERVICE_URL

## View Logs
gcloud run logs read $SERVICE_NAME --region $REGION --limit 50

## View Service Details
gcloud run services describe $SERVICE_NAME --region $REGION

## Redeploy
./deploy.sh --project-id $PROJECT_ID

## Delete Service
gcloud run services delete $SERVICE_NAME --region $REGION
EOF

log "Info saved to deployment-commands.txt"
