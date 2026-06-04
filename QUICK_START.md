# MP3 Conversion Service - Quick Start (10 Minutes)

## TL;DR - Just Deploy It

```bash
# Step 1: Clone/navigate to project
cd ~/Desktop/AI\ interview

# Step 2: Login to Google Cloud
gcloud auth login
export GCP_PROJECT_ID="your-project-id"  # Set your project

# Step 3: Deploy Cloud Run service
cd cloud-run
./deploy.sh --project-id $GCP_PROJECT_ID

# Step 4: Save the service URL
# The script will output: https://mp3-conversion-XXXXX.run.app
export MP3_SERVICE_URL="https://mp3-conversion-XXXXX.run.app"

# Step 5: Update frontend environment
cd ../src/frontend
echo "VITE_MP3_SERVICE_URL=$MP3_SERVICE_URL" >> .env.local

# Step 6: Update React code (see UPLOAD_SCREEN_CHANGES.md)
# File: src/frontend/src/screens/UploadScreen.tsx
# - Add: import { convertAndUploadAudio } from "../utils/mp3-upload"
# - Replace: convertAudioBlobToMp3() with convertAndUploadAudio()

# Step 7: Update Apps Script
# Copy function from: cloud-run/APPS_SCRIPT_UPDATES.gs
# Paste into: Google Apps Script editor → script.gs
# Add uploadAudioMp3 function
# Update doPost handler

# Step 8: Deploy everything
cd ../..
git add -A
git commit -m "feat: add Cloud Run MP3 conversion service"
git push origin main  # Vercel auto-deploys

# Step 9: Test it
# 1. Start an interview
# 2. Complete it
# 3. Check console for [MP3] and [Drive] logs
# 4. Download MP3 from Google Drive
# 5. Play it on Windows Media Player / VLC / Mobile
```

---

## Pre-Requisites (5 minutes)

```bash
# 1. Google Cloud CLI
gcloud --version  # Should be >= 400

# 2. Docker (for local testing)
docker --version  # Should be >= 20.0

# 3. Project setup
gcloud config list  # Shows current project
gcloud projects list  # Lists all projects

# 4. Git
git --version
git status

# 5. Environment
export GCP_PROJECT_ID="your-google-cloud-project-id"
echo $GCP_PROJECT_ID  # Should output your project ID
```

---

## Deploy Cloud Run Service (5 minutes)

```bash
cd cloud-run

# Make script executable
chmod +x deploy.sh

# Deploy (this takes ~5-10 minutes)
./deploy.sh --project-id $GCP_PROJECT_ID

# Wait for deployment to complete...
# Output will show: Service URL: https://mp3-conversion-XXXXX.run.app

# Save the URL
export MP3_SERVICE_URL=$(gcloud run services describe mp3-conversion \
  --region us-central1 \
  --format 'value(status.url)')

echo "✓ Cloud Run deployed at: $MP3_SERVICE_URL"

# Verify it's working
curl $MP3_SERVICE_URL/health
# Should return: {"status":"healthy",...}
```

---

## Test Cloud Run Service (3 minutes)

```bash
cd cloud-run

# Make test script executable
chmod +x test.sh

# Run test
./test.sh $MP3_SERVICE_URL

# Expected output:
# ✓ Service is healthy
# ✓ Test audio generated
# ✓ Conversion successful
# ✓ MP3 saved: test-output.mp3
# ✓ All tests passed!

# Test playback
open test-output.mp3  # macOS
# or
vlc test-output.mp3   # Linux/Windows
```

---

## Update React Frontend (3 minutes)

### Option A: Automated (if you have TypeScript set up)

```bash
cd src/frontend/src/utils

# File already exists: mp3-upload.ts
# No changes needed!

cd ../screens

# Update UploadScreen.tsx
# Find the import section and add:
# import { convertAndUploadAudio, checkMP3ServiceHealth } from "../utils/mp3-upload";

# Find runUpload() function
# Replace the conversion section with:
#
# const uploadResult = await convertAndUploadAudio(blob, {
#   candidateName: state.candidateName,
#   interviewId: state.interviewId,
#   onProgress: (progress) => {
#     setProgress(15 + (progress * 0.75));
#   },
# });
```

### Option B: Manual Copy-Paste

```bash
# File to update: src/frontend/src/screens/UploadScreen.tsx

# 1. Find this section:
# const audioBlob = await convertAudioBlobToMp3(blob);

# 2. Replace with:
# const serviceHealthy = await checkMP3ServiceHealth();
# if (!serviceHealthy) {
#   throw new Error("MP3 conversion service is unavailable");
# }
#
# const uploadResult = await convertAndUploadAudio(blob, {
#   candidateName: state.candidateName,
#   interviewId: state.interviewId,
#   onProgress: (progress) => {
#     setProgress(15 + (progress * 0.75));
#   },
# });
#
# if (uploadResult.success) {
#   driveLink = uploadResult.link;
# }

# 3. Add this import at the top:
# import { convertAndUploadAudio, checkMP3ServiceHealth } from "../utils/mp3-upload";

# 4. Remove these imports (no longer needed):
# - convertAudioBlobToMp3 from utils/audio
# - startResumableUpload, uploadChunk from api
```

---

## Update Google Apps Script (2 minutes)

```bash
# 1. Go to: https://script.google.com
# 2. Select your AI Interview project
# 3. Click "+ New" → "File" → "Script file"
# 4. Name it: mp3-handler
# 5. Paste the uploadAudioMp3 function from:
#    cloud-run/APPS_SCRIPT_UPDATES.gs
# 6. In the doPost function, add:
#    if (action === "uploadAudioMp3") {
#      return respond(uploadAudioMp3(...));
#    }
# 7. Click "Deploy" → "New deployment"
# 8. Select type: "Web app"
# 9. Click "Deploy"
```

---

## Set Environment Variables (1 minute)

```bash
# Option 1: Local .env file
cd src/frontend
echo "VITE_MP3_SERVICE_URL=$MP3_SERVICE_URL" >> .env.local

# Option 2: Vercel Dashboard
# Go to: https://vercel.com → Project Settings → Environment Variables
# Add:
#   Key: VITE_MP3_SERVICE_URL
#   Value: https://mp3-conversion-XXXXX.run.app
# Click: Add
# Then: Redeploy

# Option 3: Deploy with vercel CLI
cd src/frontend
vercel env add VITE_MP3_SERVICE_URL
# Paste: https://mp3-conversion-XXXXX.run.app
vercel deploy --prod
```

---

## Test End-to-End (5 minutes)

```bash
# 1. Go to your app: https://rawalwasia-ai-interview.vercel.app

# 2. Start an interview
#    - Enter OTP
#    - Load interview data
#    - Answer 1-2 questions

# 3. Upload the recording
#    - Should see toast: "Converting audio to MP3..."
#    - Watch browser console for [MP3] and [Drive] logs
#    - Should see: "Audio processed and uploaded successfully!"

# 4. Check console logs
#    Open DevTools (F12) → Console
#    Should see messages like:
#    [MP3] Starting conversion for John_Doe (INT-123)
#    [MP3] Input size: 25.3 MB
#    [MP3] Conversion successful
#    [MP3] Output size: 5.2 MB
#    [Drive] Upload successful
#    [Drive] Link: https://drive.google.com/file/d/...

# 5. Download and test the MP3
#    - Find the Google Drive link in the success message
#    - Download the MP3 file
#    - Test on multiple players:
#      - Windows Media Player
#      - VLC Media Player
#      - Mobile phone (iPhone/Android)
#      - Web player

# 6. Verify file properties
#    - Right-click file → Properties
#    - Name: should end in .mp3
#    - Size: should be 4-10 MB (for 15-30 min recording)
#    - File type: should be Audio (.mp3 or MPEG)
```

---

## Verify It's Working

```bash
# Check all components are up

# 1. Cloud Run service
curl https://mp3-conversion-XXXXX.run.app/health

# 2. React frontend
curl https://rawalwasia-ai-interview.vercel.app/

# 3. Google Apps Script
# Test by completing an interview

# 4. Google Drive
# Verify MP3 file exists and is playable

# All green? You're done! ✓
```

---

## Troubleshooting (1 minute)

| Problem | Solution |
|---------|----------|
| "Service URL not found" | Run `./deploy.sh --project-id $GCP_PROJECT_ID` |
| "MP3 service unavailable" | Check: `gcloud run logs read mp3-conversion` |
| "MP3 conversion failed" | See Cloud Run logs for ffmpeg error |
| "File not uploaded to Drive" | Check Apps Script deployment has new function |
| "Downloaded file won't play" | Verify MIME type is audio/mpeg (right-click → Properties) |
| "Conversion takes too long" | Normal for 30+ minute recordings (45-90 seconds) |

---

## What Just Happened?

✅ You created a **cloud-native audio processing pipeline** that:

1. **Records** WebM/Opus audio in browser (48 kHz, 16-bit)
2. **Converts** to genuine MP3 using FFmpeg in Cloud Run
3. **Uploads** MP3 to Google Drive with correct MIME type
4. **Stores** real, playable files (not fake MP3s)
5. **Costs** $0/month (within free tier)
6. **Scales** to 160+ interviews/month before paid tier

---

## Next Steps

1. **Monitor** - Check Cloud Run logs daily for errors
2. **Test** - Do 5-10 complete interviews
3. **Verify** - Download files and test playback
4. **Document** - Keep deployment commands safe
5. **Backup** - Download interview data monthly

---

## Support

**Deployment Docs:** See `DEPLOYMENT_GUIDE_DETAILED.md`
**Architecture:** See `MP3_ARCHITECTURE_SECURITY.md`
**Code Changes:** See `UPLOAD_SCREEN_CHANGES.md`
**Apps Script:** See `APPS_SCRIPT_UPDATES.gs`
**Troubleshooting:** Check Cloud Run logs: `gcloud run logs read mp3-conversion`
