# MP3 Conversion Service - Complete Implementation Guide

## Architecture Overview

```
┌──────────────────────────────────┐
│   React Frontend (Vercel)         │
│  - Recording: WebM/Opus          │
│  - Upload: base64 blob           │
└─────────────┬──────────────────────┘
              │
              │ POST /upload-audio
              │ (base64 WebM/Opus)
              │
              ▼
┌──────────────────────────────────────────────┐
│  Google Cloud Run (FastAPI Service)           │
│  ┌─────────────────────────────────────────┐  │
│  │ • Receive WebM/Opus base64 blob         │  │
│  │ • Save to /tmp/input.webm               │  │
│  │ • Run: ffmpeg -i input.webm output.mp3  │  │
│  │ • Verify MP3 integrity                  │  │
│  │ • Convert to base64                     │  │
│  │ • Return MP3 data + metadata            │  │
│  └─────────────────────────────────────────┘  │
└─────────────┬────────────────────────────────┘
              │
              │ Response: { mp3_base64, filename, mime }
              │
              ▼
┌──────────────────────────────────────────┐
│  Google Apps Script                      │
│  ┌──────────────────────────────────────┐ │
│  │ • Receive MP3 base64 from Cloud Run  │ │
│  │ • Create Blob with audio/mpeg MIME   │ │
│  │ • Set extension from Content-Type    │ │
│  │ • Upload to Google Drive             │ │
│  │ • Return public link                 │ │
│  └──────────────────────────────────────┘ │
└─────────────┬──────────────────────────────┘
              │
              ▼
┌──────────────────────────────────────┐
│  Google Drive                         │
│  Valid MP3 files (genuinely playable) │
│  Extension: .mp3                      │
│  MIME: audio/mpeg (correct)           │
└──────────────────────────────────────┘
```

## Implementation Plan

### Phase 1: Cloud Run Service Setup (Days 1-2)
- Create FastAPI service with FFmpeg
- Implement audio conversion endpoint
- Add error handling and validation
- Create Dockerfile
- Test locally with Docker

### Phase 2: Frontend Integration (Day 1)
- Update React upload flow
- Call Cloud Run instead of Apps Script directly
- Add progress tracking
- Error handling

### Phase 3: Google Apps Script Updates (Day 1)
- Update upload endpoint to accept MP3 from Cloud Run
- Remove hardcoded .mp3 extension logic
- Fix MIME type handling

### Phase 4: Deployment (Day 2)
- Deploy Cloud Run service
- Update environment variables
- Test end-to-end
- Monitor performance

### Phase 5: Verification & Rollback (Day 2-3)
- Test file playback on multiple devices
- Verify Google Drive metadata
- Implement rollback plan
- Document results

## Cost Breakdown

**Google Cloud Run (100 interviews/month, 15-30 min each)**

Assumptions:
- Average file size: 30MB WebM → 5-8MB MP3
- Processing time: 20-60 seconds per file
- Memory: 2GB RAM
- CPU: 2 vCPU

Monthly calculations:
- 100 files × 40 seconds = 66.7 minutes = 4,000 vCPU-seconds
- 4,000 vCPU-seconds × 2 vCPU = 8,000 CPU-seconds
- 8,000 CPU-seconds / 3,600 = 2.2 vCPU-hours × $0.00002400 = $0.052

**Free Tier:** 180,000 vCPU-seconds/month
- 100 interviews = 8,000 CPU-seconds
- **100% covered by free tier** ✅

**Pricing If Exceeding Free Tier:**
- vCPU: $0.00002400/second
- Memory: $0.00000250/GB-second
- Requests: $0.40 per million requests

**Actual Monthly Cost: FREE (within free tier limits)**

---

## Security Considerations

1. **Input Validation**
   - Max file size: 500MB (prevent DoS)
   - MIME type verification before processing
   - Filename sanitization

2. **Access Control**
   - Cloud Run service URL not public (use only from backend)
   - Service-to-service authentication via Google Cloud Service Accounts
   - Apps Script calls Cloud Run with API key

3. **Temporary File Management**
   - /tmp storage auto-cleaned by Cloud Run
   - Set 60-second timeout per request
   - Delete files after processing

4. **Logging**
   - Log all conversion requests (audit trail)
   - Monitor for failures
   - Alert on repeated errors

---

## Rollback Plan

If issues occur, rollback sequence:

1. **Immediate:** Revert Apps Script to direct upload (fallback to WebM upload)
2. **Keep:** React changes (they're backward compatible)
3. **Disable:** Cloud Run service (but don't delete)
4. **Recovery:** Update Apps Script to accept WebM with correct MIME type

Rollback time: 5 minutes (manual update to Apps Script)

---

## Testing Checklist

- [ ] Cloud Run service responds to /health
- [ ] Conversion endpoint accepts valid WebM
- [ ] Rejects files > 500MB
- [ ] Returns valid MP3 (ffprobe verification)
- [ ] MP3 plays on Windows Media Player
- [ ] MP3 plays on VLC
- [ ] MP3 plays on mobile (Android/iOS)
- [ ] Google Drive correctly stores with .mp3
- [ ] Downloaded files are playable
- [ ] Error handling for failed conversion
- [ ] Performance: processes 40-60 second file in <2 minutes
- [ ] Load testing: 5 concurrent requests

---

## Files to Create

1. `cloud-run/app.py` - FastAPI service with FFmpeg
2. `cloud-run/Dockerfile` - Container image
3. `cloud-run/requirements.txt` - Python dependencies
4. `cloud-run/deploy.sh` - Deployment script
5. `src/frontend/src/utils/mp3-upload.ts` - React integration
6. `script.gs.updated` - Updated Google Apps Script
7. `DEPLOYMENT_GUIDE.md` - Step-by-step instructions
8. `TESTING_GUIDE.md` - QA checklist
