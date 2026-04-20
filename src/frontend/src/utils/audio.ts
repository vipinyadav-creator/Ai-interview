import { FFmpeg } from "@ffmpeg/ffmpeg";

// We keep a single ffmpeg instance to avoid re-downloading/loading the wasm.
const ffmpeg = new FFmpeg();
let ffmpegLoadPromise: Promise<void> | null = null;

async function ensureFfmpegLoaded(): Promise<void> {
  if (ffmpeg.loaded) return;
  if (!ffmpegLoadPromise) {
    // Timeout added for mobile safety
    ffmpegLoadPromise = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("FFmpeg load timeout")), 15000);
      ffmpeg.load().then(() => {
        clearTimeout(timeout);
        resolve();
      }).catch(err => {
        clearTimeout(timeout);
        reject(err);
      });
    });
  }
  await ffmpegLoadPromise;
}

export async function warmAudioConversion(): Promise<void> {
  try {
    await ensureFfmpegLoaded();
  } catch (error) {
    console.warn("Warming FFmpeg failed, but will retry during conversion.");
  }
}

function getAudioExtension(mimeType: string): string {
  switch (mimeType) {
    case "audio/mp4":
    case "audio/x-m4a":
    case "audio/aac":
      return "mp4";
    case "audio/ogg":
    case "audio/ogg;codecs=opus":
      return "ogg";
    case "audio/mpeg":
    case "audio/mp3":
      return "mp3";
    case "audio/webm":
    case "audio/webm;codecs=opus":
    default:
      return "webm";
  }
}

export async function convertAudioBlobToMp3(audioBlob: Blob): Promise<Blob> {
  if (audioBlob.type === "audio/mpeg" || audioBlob.type === "audio/mp3") {
    return audioBlob;
  }

  const originalMime = audioBlob.type || "audio/webm";
  const extension = getAudioExtension(originalMime);

  try {
    await ensureFfmpegLoaded();

    // Use simple file names inside ffmpeg FS.
    const inputName = `input.${extension}`;
    const outputName = "output.mp3";

    // Convert Blob -> Uint8Array for ffmpeg FS.
    const inputData = new Uint8Array(await audioBlob.arrayBuffer());
    await ffmpeg.writeFile(inputName, inputData);

    try {
      // Voice-focused MP3 output + Mobile RAM Optimized
      await ffmpeg.exec([
        "-i", inputName,
        "-vn",          // No video
        "-ac", "1",     // Mono channel (saves memory)
        "-ar", "22050", // 22050 Hz (good for voice, saves memory)
        "-acodec", "libmp3lame",
        "-b:a", "48k",  // 48kbps bitrate (lightweight)
        outputName,
      ]);

      const mp3Data = await ffmpeg.readFile(outputName);
      if (mp3Data instanceof Uint8Array) {
        const mp3Bytes = new Uint8Array(mp3Data.byteLength);
        mp3Bytes.set(mp3Data);
        return new Blob([mp3Bytes.buffer], { type: "audio/mpeg" });
      }

      // Fallback if string encoding is returned (shouldn't happen).
      return new Blob([String(mp3Data)], { type: "audio/mpeg" });
    } finally {
      // Cleanup FS to avoid growing memory between conversions.
      try {
        await ffmpeg.deleteFile(inputName);
      } catch {
        // ignore
      }
      try {
        await ffmpeg.deleteFile(outputName);
      } catch {
        // ignore
      }
    }
  } catch (error) {
    console.error("MP3 Conversion failed (Normal on mobile). Returning original blob.", error);
    // Return raw audio if conversion fails so the interview isn't lost
    return audioBlob;
  }
}

export const convertWebmOpusToMp3 = convertAudioBlobToMp3;