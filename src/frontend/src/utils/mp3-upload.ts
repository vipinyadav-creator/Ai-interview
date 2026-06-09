/**
 * MP3 Upload Service
 * 
 * Integrates with Google Cloud Run MP3 conversion service.
 * Converts WebM/Opus to MP3, then uploads to Google Drive.
 * 
 * File: src/frontend/src/utils/mp3-upload.ts
 */

import { toast } from "sonner";

// ============================================================================
// Configuration
// ============================================================================

const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzzl0QBIWy-_MUmXDcaWRsGGGkv4Z5HUKXkosVZO5_7ErTBINjutlGHwZdv8Cmhvjenxg/exec";


// ============================================================================
// Types
// ============================================================================



export interface UploadDebugEvent {
  httpStatus?: number;
  audioUrl?: string;
  errorMessage?: string;
  audioBytes?: number;
}

interface UploadOptions {
  candidateName: string;
  interviewId: string;
  onProgress?: (progress: number) => void;
  onDebug?: (event: UploadDebugEvent) => void;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Convert a Blob to base64 string
 */
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(",")[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Decode base64 string back to Blob
 */
function base64ToBlob(base64: string, mimeType: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeType });
}

function buildAudioFileName(
  candidateName: string,
  interviewId: string,
  extension: string
): string {
  const safeCandidate = candidateName.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_-]/g, "_");
  const safeInterview = interviewId.replace(/[^a-zA-Z0-9_-]/g, "_");
  const safeExt = extension.replace(/[^a-zA-Z0-9]/g, "");
  return `${safeCandidate}_${safeInterview}.${safeExt}`;
}


/**
 * Format bytes to human-readable format
 */
function formatBytes(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * Math.pow(10, dm)) / Math.pow(10, dm) + " " + sizes[i];
}

// ============================================================================
// Core Conversion Function
// ============================================================================

// (MP3 conversion removed: audio is uploaded directly to Drive)

function getAudioExtensionFromMimeType(mimeType: string): string {
  const mt = mimeType.toLowerCase();
  if (mt.includes("webm") || mt.includes("opus") || mt.includes("ogg")) return "webm";
  if (mt.includes("mp3")) return "mp3";
  if (mt.includes("mp4") || mt.includes("m4a") || mt.includes("aac")) return "mp4";
  if (mt.includes("mpeg")) return "mp3";
  return "webm";
}


// ============================================================================
// Google Drive Upload Function
// ============================================================================

/**
 * Upload recorded audio blob to Google Drive via Apps Script
 * 
 * @param audioBlob - Recorded audio blob
 * @param candidateName - Candidate name
 * @param interviewId - Interview ID
 * @param onProgress - Progress callback (0-100)
 * @returns Google Drive link
 */
export async function uploadRecordedAudioToDrive(
  audioBlob: Blob,
  options: UploadOptions,
): Promise<{ success: boolean; link: string; message?: string }> {
  try {
    const { candidateName, interviewId, onProgress, onDebug } = options;

    onProgress?.(10);
    console.log(`[Drive] Starting audio upload for ${candidateName} (${interviewId})`);
    console.log(`[Drive] File size: ${formatBytes(audioBlob.size)}`);


    // Encode audio to base64
    onProgress?.(20);
    onDebug?.({ audioBytes: audioBlob.size });
    console.log(`[Drive] Encoding audio to base64...`);
    const audioBase64 = await blobToBase64(audioBlob);

    console.log(`[Drive] audioBase64 length`, audioBase64.length);


    // Upload to Google Drive via Apps Script

    onProgress?.(40);
    console.log(`[Drive] Sending to Google Drive via Apps Script...`);

    const mimeType = audioBlob.type || "audio/webm";
    const extension = getAudioExtensionFromMimeType(mimeType);
    const fileName = buildAudioFileName(candidateName, interviewId, extension);



    const uploadRequest = {
      action: "uploadAudio",
      base64Data: audioBase64,
      fileName,
      mimeType,
      candidateName,
      interviewId,
    };

    const response = await fetch(APPS_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify(uploadRequest),
      redirect: "follow",
    });

    const httpStatus = response.status;
    if (!response.ok) {
      onDebug?.({ httpStatus, errorMessage: `Apps Script error: ${httpStatus}` });
      throw new Error(`Apps Script error: ${httpStatus}`);
    }

    onProgress?.(80);

    const text = await response.text();
    let data: any;

    try {
      data = JSON.parse(text);
    } catch {
      throw new Error("Invalid response from Apps Script");
    }

    if (!data.success) {
      onDebug?.({
        httpStatus,
        errorMessage: data.message || "Upload failed",
      });
      throw new Error(data.message || "Upload failed");
    }

    console.log(`[Drive] Upload successful`);
    console.log(`[Drive] Link: ${data.link}`);

    onProgress?.(100);
    onDebug?.({ httpStatus, audioUrl: data.link, audioBytes: audioBlob.size });

    return { success: true, link: data.link, message: data.message };
  } catch (error) {
    console.error(`[Drive] Upload failed:`, error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    onDebug?.({ errorMessage });
    toast.error(`Drive upload failed: ${errorMessage}`);
    throw error;
  }
}

// ============================================================================
// Complete Upload Flow
// ============================================================================

/**
 * Complete flow: Convert WebM/Opus to MP3, upload to Google Drive
 * 
 * @param webmBlob - WebM/Opus audio blob
 * @param options - Upload options
 * @returns Google Drive link
 */

