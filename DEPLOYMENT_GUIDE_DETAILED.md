# MP3 Conversion Service - Complete Deployment Guide

## Pre-Deployment Checklist

- [ ] Google Cloud Project created
- [ ] Billing enabled on Google Cloud Project
- [ ] Google Cloud SDK (gcloud) installed locally
- [ ] Docker installed (for local testing)
- [ ] FFmpeg installed locally (for testing)
- [ ] Access to Google Drive folder for audio uploads
- [ ] Access to Google Apps Script project
- [ ] Vercel access for React frontend
- [ ] Git repository for version control

---

## Phase 1: Local Testing (15 minutes)

### 1.1 Install Dependencies

```bash
# Navigate to cloud-run directory
cd cloud-run

# Option A: Using Docker (recommended)
docker --version  # Verify Docker is installed

# Option B: Using local Python
python3 --version  # Verify Python 3.11+
pip3 install -r requirements.txt
ffmpeg -version  # Verify FFmpeg is installed
ffprobe -version # Verify ffprobe is installed
```

### 1.2 Run Locally with Docker

```bash
# Build local image
docker build -t mp3-conversion:local .

# Run container
docker run -it --rm \
  -p 8080:8080 \
  -e LOG_LEVEL=INFO \
  mp3-conversion:local
```

### 1.3 Run Locally with Python (Direct)

```bash
# Install dependencies
pip3 install -r requirements.txt

# Run the service
python3 app.py

# In another terminal, test the health endpoint
curl http://localhost:8080/health
```

### 1.4 Test Conversion Locally

```bash
# From cloud-run directory
cd ..

# Run test script
bash cloud-run/test.sh http://localhost:8080

# The script will:
# 1. Check service health
# 2. Generate test WebM audio
# 3. Send to conversion endpoint
# 4. Receive MP3
# 5. Verify with ffprobe
# 6. Save test output to test-output.mp3

# Test output file manually
# macOS: open test-output.mp3
# Linux: vlc test-output.mp3
# Windows: start test-output.mp3
```

**Expected Results:**
- ✅ Health check returns `{"status": "healthy"}`
- ✅ Conversion completes in < 60 seconds
- ✅ MP3 file is playable
- ✅ No errors in conversion logs

---

## Phase 2: Google Cloud Preparation (30 minutes)

### 2.1 Create Google Cloud Project

```bash
# Login to gcloud
gcloud auth login

# List existing projects
gcloud projects list

# Create new project (if needed)
gcloud projects create mp3-conversion-service --name="MP3 Conversion Service"

# Set as active project
export GCP_PROJECT_ID="mp3-conversion-service"
gcloud config set project $GCP_PROJECT_ID

# Or use existing project
export GCP_PROJECT_ID="your-existing-project-id"
gcloud config set project $GCP_PROJECT_ID
```

### 2.2 Enable Required APIs

```bash
# Enable Container Registry (for storing images)
gcloud services enable containerregistry.googleapis.com

# Enable Cloud Build (for building images)
gcloud services enable cloudbuild.googleapis.com

# Enable Cloud Run (for running service)
gcloud services enable run.googleapis.com

# Verify APIs are enabled
gcloud services list --enabled | grep -E "run|build|container"
```

### 2.3 Create Service Account (Optional, for production)

```bash
# Create service account
gcloud iam service-accounts create mp3-conversion \
  --display-name="MP3 Conversion Service"

# Grant necessary permissions
gcloud projects add-iam-policy-binding $GCP_PROJECT_ID \
  --member="serviceAccount:mp3-conversion@${GCP_PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/run.admin"

# Create and download key
gcloud iam service-accounts keys create mp3-conversion-key.json \
  --iam-account=mp3-conversion@${GCP_PROJECT_ID}.iam.gserviceaccount.com

echo "Service account key saved to mp3-conversion-key.json"
```

---

## Phase 3: Deploy to Cloud Run (30 minutes)

### 3.1 Deploy Using Script (Recommended)

```bash
cd cloud-run

# Make script executable
chmod +x deploy.sh

# Deploy to Cloud Run
./deploy.sh --project-id $GCP_PROJECT_ID

# The script will:
# 1. Enable required APIs
# 2. Build Docker image using Cloud Build
# 3. Push image to Container Registry
# 4. Deploy to Cloud Run
# 5. Return service URL
```

### 3.2 Manual Deployment

```bash
cd cloud-run

# Build image with Cloud Build
gcloud builds submit \
  --tag gcr.io/${GCP_PROJECT_ID}/mp3-conversion \
  --project $GCP_PROJECT_ID

# Deploy to Cloud Run
gcloud run deploy mp3-conversion \
  --image gcr.io/${GCP_PROJECT_ID}/mp3-conversion \
  --region us-central1 \
  --platform managed \
  --memory 2Gi \
  --cpu 2 \
  --timeout 600 \
  --concurrency 100 \
  --allow-unauthenticated \
  --set-env-vars LOG_LEVEL=INFO \
  --project $GCP_PROJECT_ID

# Get service URL
gcloud run services describe mp3-conversion \
  --region us-central1 \
  --format 'value(status.url)' \
  --project $GCP_PROJECT_ID
```

### 3.3 Verify Cloud Run Deployment

```bash
# Get service URL
SERVICE_URL=$(gcloud run services describe mp3-conversion \
  --region us-central1 \
  --format 'value(status.url)' \
  --project $GCP_PROJECT_ID)

echo "Service URL: $SERVICE_URL"

# Test health endpoint
curl $SERVICE_URL/health

# Expected output:
# {"status":"healthy","timestamp":"2026-06-02T...","service":"mp3-conversion"}

# View service details
gcloud run services describe mp3-conversion --region us-central1

# View recent logs
gcloud run logs read mp3-conversion --limit 50
```

### 3.4 Save Service URL

```bash
# Save to environment variable for later use
export MP3_SERVICE_URL=$(gcloud run services describe mp3-conversion \
  --region us-central1 \
  --format 'value(status.url)' \
  --project $GCP_PROJECT_ID)

echo "MP3_SERVICE_URL=$MP3_SERVICE_URL"

# Save to file for Vercel
echo "VITE_MP3_SERVICE_URL=$MP3_SERVICE_URL" > .env.mp3-service
```

---

## Phase 4: Frontend Integration (30 minutes)

### 4.1 Add MP3 Service URL to Vercel

```bash
cd src/frontend

# Option A: Update .env file locally
echo "VITE_MP3_SERVICE_URL=$MP3_SERVICE_URL" >> .env.local

# Option B: Update Vercel dashboard
# 1. Go to Vercel Dashboard → Project Settings → Environment Variables
# 2. Add new variable:
#    Name: VITE_MP3_SERVICE_URL
#    Value: https://mp3-conversion-XXXXX.run.app
# 3. Redeploy the frontend
```

### 4.2 Update React Code

**File:** `src/frontend/src/screens/UploadScreen.tsx`

```typescript
// 1. Add import at top
import { convertAndUploadAudio, checkMP3ServiceHealth } from "../utils/mp3-upload";

// 2. Remove these imports (no longer needed)
// - import { convertAudioBlobToMp3, getAudioExtension } from "../utils/audio";
// - import { startResumableUpload, uploadChunk, uploadAudioToDrive } from "../api";

// 3. Replace the conversion section in runUpload()
// See UPLOAD_SCREEN_CHANGES.md for detailed changes
```

### 4.3 Test Frontend Changes

```bash
# Build the frontend
npm run build

# Or run in dev mode
npm run dev

# Test the upload screen:
# 1. Start an interview
# 2. Answer questions and reach upload screen
# 3. Verify toast messages show "Converting audio to MP3..."
# 4. Verify audio is uploaded successfully
# 5. Check console logs for [MP3] and [Drive] messages
```

### 4.4 Deploy to Vercel

```bash
# Commit changes
git add src/frontend/src/screens/UploadScreen.tsx
git add src/frontend/src/utils/mp3-upload.ts
git commit -m "feat: integrate Cloud Run MP3 conversion service"

# Push to GitHub (Vercel auto-deploys)
git push origin main

# Or deploy manually
cd src/frontend
vercel deploy --prod

# Verify deployment
# Go to your Vercel project URL and test the full flow
```

---

## Phase 5: Google Apps Script Updates (15 minutes)

### 5.1 Add New Function to Apps Script

**File:** Google Apps Script Project

```javascript
// 1. Open Google Apps Script editor
// 2. Go to your existing script.gs
// 3. Add the new uploadAudioMp3() function
// 4. Copy from: cloud-run/APPS_SCRIPT_UPDATES.gs

// The function handles:
// - Receiving MP3 base64 from Cloud Run service
// - Creating Blob with correct audio/mpeg MIME type
// - Uploading to Google Drive with .mp3 extension
// - Returning shareable link
```

### 5.2 Update doPost Handler

**File:** Google Apps Script

```javascript
// In your doPost() function, add this line:
if (action === "uploadAudioMp3") {
  return respond(uploadAudioMp3(
    body.base64Data,
    body.fileName,
    body.mimeType,
    body.candidateName,
    body.interviewId
  ));
}
```

### 5.3 Deploy Apps Script

```javascript
// 1. In Apps Script editor, click "Deploy" → "New deployment"
// 2. Select type: "Web app"
// 3. Execute as: (your email)
// 4. Who has access: "Anyone"
// 5. Click "Deploy"
// 6. Confirm you want to update the existing deployment
```

### 5.4 Test Apps Script Function

```javascript
// In Apps Script editor:
// 1. Run → testMp3Upload()
// 2. Check execution logs
// 3. Verify the file was created in Google Drive

// Or test from React:
// 1. Complete an interview
// 2. Watch the upload progress
// 3. Check Google Drive for the MP3 file
```

---

## Phase 6: End-to-End Testing (60 minutes)

### 6.1 Single File Test

```bash
# 1. Start a complete interview
# 2. Answer at least one question
# 3. Reach the upload screen
# 4. Monitor browser console for conversion logs

# Expected console output:
# [MP3] Starting conversion...
# [MP3] Input size: XX.X MB
# [MP3] Encoding to base64...
# [MP3] Sending to Cloud Run: https://...
# [MP3] Conversion successful
# [MP3] Output size: XX.X MB
# [Drive] Uploading to Google Drive...
# [Drive] Upload successful
# [Drive] Link: https://drive.google.com/...

# 5. Check Google Drive for the file
# 6. Download and verify MP3 is playable on Windows/Mac/Mobile
```

### 6.2 Playback Testing

```bash
# Download the MP3 from Google Drive and test on:
# ✅ Windows Media Player (Desktop)
# ✅ VLC Media Player (Any OS)
# ✅ iPhone Music App
# ✅ Android Media Player
# ✅ WhatsApp (share MP3)
# ✅ Standard web players

# File should be:
# - Playable on all devices
# - Have correct duration
# - Have correct file size (5-10MB for 15-30 min recording)
# - Have no errors or artifacts
```

### 6.3 Performance Testing

```bash
# Monitor Cloud Run metrics:
# 1. Go to Google Cloud Console
# 2. Cloud Run → mp3-conversion → Logs
# 3. Check conversion times:
#    - Expected: 20-60 seconds per 30-minute recording
#    - Memory usage: < 1.5 GB
#    - CPU usage: < 100%

# Test concurrent requests:
# 1. Start 5 interviews simultaneously
# 2. All should process without queueing
# 3. Check Cloud Run concurrency metrics

# Monitor costs:
# 1. Go to Cloud Billing
# 2. Verify usage is within free tier
# 3. Expected: $0 for 100 interviews/month
```

### 6.4 Error Scenario Testing

```bash
# Test 1: Large file (>500MB)
# - Upload should fail with appropriate error
# - Frontend should show error toast

# Test 2: Network failure
# - Stop internet during conversion
# - Frontend should show error message
# - Retry should work after internet is back

# Test 3: Invalid audio
# - Corrupt the base64 before sending
# - Cloud Run should reject with validation error

# Test 4: Service unavailable
# - Stop Cloud Run service
# - Health check should fail
# - Frontend should prevent upload with message
```

---

## Phase 7: Monitoring & Maintenance

### 7.1 Set Up Cloud Monitoring

```bash
# View real-time metrics
gcloud run services describe mp3-conversion --region us-central1

# View logs
gcloud run logs read mp3-conversion --limit 100

# Create log filter for errors
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=mp3-conversion AND severity=ERROR" \
  --limit 50 \
  --format json
```

### 7.2 Monitor Costs

```bash
# Check usage in free tier
# Maximum free tier usage per month:
# - vCPU: 180,000 vCPU-seconds
# - Memory: 360,000 GB-seconds  
# - Requests: 2 million requests
# - For 100 files @ 40 seconds each = 8,000 vCPU-seconds = 4.4% of free tier

# Monitor actual usage
gcloud billing accounts list
gcloud billing accounts describe [ACCOUNT_ID]
```

### 7.3 Alerting

```bash
# Create alert for high error rate
# 1. Google Cloud Console → Cloud Monitoring → Alerting
# 2. Create policy for:
#    - Error rate > 5%
#    - Response time > 60 seconds
#    - Memory usage > 1.8 GB
# 3. Set notification to email/Slack
```

### 7.4 Regular Maintenance

**Weekly:**
- Check error logs
- Monitor cost trends
- Test conversion on random interview

**Monthly:**
- Review performance metrics
- Check if free tier is sufficient
- Update dependencies if needed

**Quarterly:**
- Backup Google Apps Script
- Review security settings
- Plan for growth

---

## Troubleshooting

### Issue: Cloud Run Service Not Responding

```bash
# 1. Check service status
gcloud run services describe mp3-conversion --region us-central1

# 2. Check recent logs for errors
gcloud run logs read mp3-conversion --limit 20

# 3. Restart service
gcloud run services update mp3-conversion --region us-central1

# 4. Rebuild and redeploy
./deploy.sh --project-id $GCP_PROJECT_ID
```

### Issue: MP3 Files Are Not Created

```bash
# 1. Check React console for error messages
# 2. Check Cloud Run logs for conversion errors
# 3. Verify FFmpeg is working:
docker run -it mp3-conversion:local ffmpeg -version

# 4. Test locally:
bash cloud-run/test.sh http://localhost:8080
```

### Issue: Files Are Still Fake MP3s

```bash
# 1. Verify Apps Script is using new uploadAudioMp3 function
# 2. Check that MIME type is "audio/mpeg"
# 3. Verify frontend is calling convertAndUploadAudio
# 4. Check Google Drive file properties:
#    - Right-click file → Details → MIME type should be audio/mpeg
#    - Name should end in .mp3
```

### Issue: Slow Conversion

```bash
# 1. Check Cloud Run CPU/Memory usage
# 2. Increase CPU: --cpu 4 (if needed)
# 3. Check if FFmpeg process is being killed
# 4. Increase timeout: --timeout 900 (if needed)
# 5. Monitor logs for conversion times
```

---

## Rollback Plan

If critical issues occur:

### Step 1: Disable Cloud Run (5 minutes)

```bash
# Option A: Stop service
gcloud run services update mp3-conversion \
  --no-allow-unauthenticated \
  --region us-central1

# Option B: Delete service entirely
gcloud run services delete mp3-conversion --region us-central1
```

### Step 2: Revert React Frontend (5 minutes)

```bash
# Revert to previous commit
git revert HEAD

# Redeploy to Vercel
git push origin main
# or
vercel deploy --prod
```

### Step 3: Update Apps Script (5 minutes)

```javascript
// In Google Apps Script, remove the new uploadAudioMp3 handler
// Keep the old uploadAudioToDrive function active
// Redeploy Apps Script
```

### Step 4: Fallback Upload (Manual)

```bash
// Update React to upload WebM with corrected metadata:
// MIME type: audio/webm
// Extension: .webm
// This creates valid WebM files instead of MP3
// Files are playable but not MP3 format
```

---

## Success Criteria Checklist

- [ ] Cloud Run service deployed and healthy
- [ ] Local testing passes all tests
- [ ] Frontend environment variable configured
- [ ] React code updated and deployed
- [ ] Apps Script updated and redeployed
- [ ] At least 3 interviews completed successfully
- [ ] Downloaded MP3 files play on Windows/Mac/Mobile
- [ ] No fake MP3 files created
- [ ] Console logs show successful conversions
- [ ] Google Drive shows correct file MIME type
- [ ] Costs remain within free tier
- [ ] Error handling works correctly
- [ ] Performance acceptable (<2 minutes for 30-min recording)

---

## Support & Resources

- Google Cloud Run Docs: https://cloud.google.com/run/docs
- FFmpeg Docs: https://ffmpeg.org/documentation.html
- FastAPI Docs: https://fastapi.tiangolo.com
- Google Apps Script Docs: https://developers.google.com/apps-script
