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

const MP3_SERVICE_URL = import.meta.env.VITE_MP3_SERVICE_URL || "https://mp3-conversion-XXXXX.run.app";
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzzl0QBIWy-_MUmXDcaWRsGGGkv4Z5HUKXkosVZO5_7ErTBINjutlGHwZdv8Cmhvjenxg/exec";
const MP3_MIME_TYPE = "audio/mpeg";

// ============================================================================
// Types
// ============================================================================

interface ConversionResponse {
  success: boolean;
  mp3_base64?: string;
  filename: string;
  mime_type: string;
  error?: string;
  duration_seconds?: number;
  input_size_bytes: number;
  output_size_bytes: number;
  conversion_time_seconds?: number;
}

interface UploadOptions {
  candidateName: string;
  interviewId: string;
  onProgress?: (progress: number) => void;
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

function buildMp3FileName(candidateName: string, interviewId: string): string {
  const safeCandidate = candidateName.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_-]/g, "_");
  const safeInterview = interviewId.replace(/[^a-zA-Z0-9_-]/g, "_");
  return `${safeCandidate}_${safeInterview}.mp3`;
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

/**
 * Convert WebM/Opus audio to MP3 using Cloud Run service
 * 
 * @param webmBlob - WebM/Opus audio blob
 * @param candidateName - Candidate name (for logging)
 * @param interviewId - Interview ID (for logging)
 * @param onProgress - Progress callback (0-100)
 * @returns MP3 blob
 */
export async function convertAudioBlobToMp3(
  webmBlob: Blob,
  candidateName: string,
  interviewId: string,
  onProgress?: (progress: number) => void
): Promise<Blob> {
  try {
    onProgress?.(10);
    console.log(`[MP3] Starting conversion for ${candidateName} (${interviewId})`);
    console.log(`[MP3] Input size: ${formatBytes(webmBlob.size)}`);

    // Step 1: Encode to base64
    onProgress?.(20);
    console.log(`[MP3] Encoding to base64...`);
    const webmBase64 = await blobToBase64(webmBlob);
    console.log(`[MP3] Base64 length: ${webmBase64.length} characters`);

    // Step 2: Send to Cloud Run service
    onProgress?.(30);
    console.log(`[MP3] Sending to Cloud Run: ${MP3_SERVICE_URL}`);

    const conversionRequest = {
      audio_base64: webmBase64,
      filename: `${candidateName}_${interviewId}.webm`,
      candidate_name: candidateName,
      interview_id: interviewId,
    };

    const response = await fetch(`${MP3_SERVICE_URL}/convert-audio`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(conversionRequest),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Cloud Run error: ${response.status} - ${errorText}`);
    }

    onProgress?.(60);

    const conversionResult: ConversionResponse = await response.json();

    if (!conversionResult.success) {
      throw new Error(`Conversion failed: ${conversionResult.error || "Unknown error"}`);
    }

    console.log(`[MP3] Conversion successful`);
    console.log(`[MP3] Output size: ${formatBytes(conversionResult.output_size_bytes)}`);
    console.log(`[MP3] Duration: ${conversionResult.duration_seconds?.toFixed(2) || "unknown"} seconds`);
    console.log(`[MP3] Conversion time: ${conversionResult.conversion_time_seconds?.toFixed(2) || "unknown"} seconds`);
    console.log(`[MP3] Compression ratio: ${(
      ((webmBlob.size - conversionResult.output_size_bytes) / webmBlob.size) * 100
    ).toFixed(1)}%`);

    // Step 3: Decode base64 MP3
    onProgress?.(80);
    console.log(`[MP3] Decoding MP3 from base64...`);

    if (!conversionResult.mp3_base64) {
      throw new Error("No MP3 data in response");
    }

    const mp3Blob = base64ToBlob(conversionResult.mp3_base64, MP3_MIME_TYPE);

    console.log(`[MP3] MP3 Blob created: ${formatBytes(mp3Blob.size)}`);
    console.log(`[MP3] MP3 MIME type: ${mp3Blob.type}`);

    onProgress?.(90);

    return mp3Blob;
  } catch (error) {
    console.error(`[MP3] Conversion failed:`, error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    toast.error(`MP3 conversion failed: ${errorMessage}`);
    throw error;
  }
}

// ============================================================================
// Google Drive Upload Function
// ============================================================================

/**
 * Upload MP3 file to Google Drive via Apps Script
 * 
 * @param mp3Blob - MP3 audio blob
 * @param candidateName - Candidate name
 * @param interviewId - Interview ID
 * @param onProgress - Progress callback (0-100)
 * @returns Google Drive link
 */
export async function uploadMp3ToDrive(
  mp3Blob: Blob,
  candidateName: string,
  interviewId: string,
  onProgress?: (progress: number) => void
): Promise<{ success: boolean; link: string; message?: string }> {
  try {
    onProgress?.(10);
    console.log(`[Drive] Starting MP3 upload for ${candidateName} (${interviewId})`);
    console.log(`[Drive] File size: ${formatBytes(mp3Blob.size)}`);

    // Encode MP3 to base64
    onProgress?.(20);
    console.log(`[Drive] Encoding MP3 to base64...`);
    const mp3Base64 = await blobToBase64(mp3Blob);

    // Upload to Google Drive via Apps Script
    onProgress?.(40);
    console.log(`[Drive] Sending to Google Drive via Apps Script...`);

    const uploadRequest = {
      action: "uploadAudioMp3",
      base64Data: mp3Base64,
      fileName: buildMp3FileName(candidateName, interviewId),
      mimeType: MP3_MIME_TYPE,
      candidateName,
      interviewId,
    };

    const response = await fetch(APPS_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify(uploadRequest),
      redirect: "follow",
    });

    if (!response.ok) {
      throw new Error(`Apps Script error: ${response.status}`);
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
      throw new Error(data.message || "Upload failed");
    }

    console.log(`[Drive] Upload successful`);
    console.log(`[Drive] Link: ${data.link}`);

    onProgress?.(100);

    return { success: true, link: data.link, message: data.message };
  } catch (error) {
    console.error(`[Drive] Upload failed:`, error);
    const errorMessage = error instanceof Error ? error.message : String(error);
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
export async function convertAndUploadAudio(
  webmBlob: Blob,
  options: UploadOptions
): Promise<{ success: boolean; link: string; mp3Size: number }> {
  const { candidateName, interviewId, onProgress } = options;

  try {
    // Phase 1: Convert to MP3 (0-50%)
    onProgress?.(0);
    toast.loading("Converting audio to MP3...");

    const mp3Blob = await convertAudioBlobToMp3(
      webmBlob,
      candidateName,
      interviewId,
      (progress) => onProgress?.(progress * 0.5)
    );

    // Phase 2: Upload to Google Drive (50-100%)
    onProgress?.(50);
    toast.loading("Uploading to Google Drive...");

    const uploadResult = await uploadMp3ToDrive(
      mp3Blob,
      candidateName,
      interviewId,
      (progress) => onProgress?.(50 + progress * 0.5)
    );

    onProgress?.(100);
    toast.success("Audio processed and uploaded successfully!");

    return {
      success: true,
      link: uploadResult.link,
      mp3Size: mp3Blob.size,
    };
  } catch (error) {
    console.error(`[Upload] Complete flow failed:`, error);
    throw error;
  }
}

// ============================================================================
// Batch Operations
// ============================================================================

/**
 * Get conversion service status
 */
export async function checkMP3ServiceHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${MP3_SERVICE_URL}/health`, {
      method: "GET",
    });
    return response.ok;
  } catch (error) {
    console.error(`[MP3] Health check failed:`, error);
    return false;
  }
}

/**
 * Get service URL (for debugging)
 */
export function getMP3ServiceUrl(): string {
  return MP3_SERVICE_URL;
}
