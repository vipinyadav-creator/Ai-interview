// FFmpeg hata diya gaya hai! Ab zero crash risk hai.

export async function warmAudioConversion(): Promise<void> {
  // Native recording ke liye kisi warming ki zaroorat nahi hai
  return Promise.resolve();
}

export function getAudioExtension(mimeType: string): string {
  if (mimeType.includes("mp4") || mimeType.includes("aac") || mimeType.includes("m4a")) return "mp4";
  if (mimeType.includes("ogg")) return "ogg";
  if (mimeType.includes("mpeg") || mimeType.includes("mp3")) return "mp3";
  return "webm"; // Default format for Android and PC
}

// Function ka naam wahi rakha hai taaki baaki app me error na aaye, 
// lekin ab ye bina kisi load ke original native audio turant return kar dega.
export async function convertAudioBlobToMp3(audioBlob: Blob): Promise<Blob> {
  return audioBlob; 
}

export const convertWebmOpusToMp3 = convertAudioBlobToMp3;