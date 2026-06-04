/**
 * Updated UploadScreen.tsx - Integration with MP3 Conversion Service
 * 
 * Changes from original:
 * 1. Import convertAndUploadAudio from mp3-upload.ts
 * 2. Remove direct Google Drive upload
 * 3. Use Cloud Run service for conversion
 * 4. Simplified upload flow
 * 
 * File location: src/frontend/src/screens/UploadScreen.tsx
 * 
 * NOTE: This shows the MODIFIED sections only.
 * Search for "CHANGE:" comments to find what to update.
 */

// CHANGE: Add this import at the top
import { convertAndUploadAudio, checkMP3ServiceHealth } from "../utils/mp3-upload";

// ============================================================================
// In the runUpload function, replace the conversion section with:
// ============================================================================

const runUpload = async () => {
  try {
    // 🌐 INTERNET CHECK (English)
    if (!navigator.onLine) {
      throw new Error(
        "Your internet connection is not working. Please check your connection and try again.",
      );
    }

    const blob = state.recordedBlob;
    let driveLink = "";

    if (!blob || blob.size === 0) {
      setStep("finalizing");
      await doFinalize(driveLink);
      return;
    }

    setStep("preparing");
    setProgress(5);

    // CHANGE: Check if MP3 service is healthy
    const serviceHealthy = await checkMP3ServiceHealth();
    if (!serviceHealthy) {
      throw new Error(
        "MP3 conversion service is unavailable. Please try again in a few moments."
      );
    }
    setProgress(15);

    // CHANGE: Use convertAndUploadAudio instead of direct conversion
    const uploadResult = await convertAndUploadAudio(blob, {
      candidateName: state.candidateName,
      interviewId: state.interviewId,
      onProgress: (progress) => {
        // Map progress from 0-100 to 15-90
        setProgress(15 + (progress * 0.75));
      },
    });

    if (uploadResult.success) {
      driveLink = uploadResult.link;
      setAudioLink(driveLink);
      setProgress(90);
    } else {
      throw new Error("Upload failed");
    }

    // Note: No chunked upload needed now - MP3 service handles it all
    // Just finalize the interview record

    setStep("finalizing");
    setProgress(92);
    await doFinalize(driveLink);
  } catch (err) {
    setStep("error");
    setErrorMsg(err instanceof Error ? err.message : "Upload failed");
    toast.error(
      `Upload failed: ${err instanceof Error ? err.message : "Error"}`,
    );
  }
};

// ============================================================================
// Remove the following sections from original UploadScreen:
// ============================================================================

// DELETE: convertAudioBlobToMp3 call
// DELETE: getAudioExtension call
// DELETE: startResumableUpload function
// DELETE: uploadChunk function
// DELETE: uploadAudioToDrive function
// DELETE: All chunked upload logic (CHUNK_SIZE, totalChunks, for loop, etc.)

// ============================================================================
// Additional Changes
// ============================================================================

// In imports at top, REMOVE these (no longer needed):
// - import { convertAudioBlobToMp3, getAudioExtension } from "../utils/audio";
// - import { startResumableUpload, uploadChunk, uploadAudioToDrive } from "../api";

// The mp3-upload.ts module handles:
// ✅ WebM/Opus → MP3 conversion (via Cloud Run)
// ✅ MP3 → Google Drive upload (via Apps Script)
// ✅ Progress tracking
// ✅ Error handling

// ============================================================================
// Before deployment, verify these environment variables exist:
// ============================================================================

// In .env or Vercel dashboard:
// VITE_MP3_SERVICE_URL=https://mp3-conversion-XXXXX.run.app

// ============================================================================
// Full Modified UploadScreen.tsx Comparison
// ============================================================================

/*

ORIGINAL FLOW:
1. convertAudioBlobToMp3() → returns unchanged blob (no-op)
2. getAudioExtension() → determines filename
3. uploadAudioToDrive() → base64 to Apps Script
4. Apps Script → sets hardcoded MIME type and .mp3 extension
5. Google Drive → stores FAKE MP3 (actually WebM)

NEW FLOW:
1. convertAndUploadAudio() combines:
   a. Calls Cloud Run MP3 service
   b. Cloud Run: FFmpeg converts WebM/Opus → genuine MP3
   c. Returns MP3 base64
   d. Calls Apps Script with MP3 data
   e. Apps Script: Sets correct MIME type (audio/mpeg)
   f. Google Drive → stores GENUINE MP3
2. Progress callback updated throughout
3. All error handling centralized in mp3-upload.ts

IMPACT:
- Simpler React code
- Better error handling
- Generated files are genuinely playable
- No fake MP3 files
- Cloud Run handles conversion (no browser CPU needed)

*/
