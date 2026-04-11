import { FFmpeg } from "@ffmpeg/ffmpeg";

// We keep a single ffmpeg instance to avoid re-downloading/loading the wasm.
const ffmpeg = new FFmpeg();
let ffmpegLoadPromise: Promise<void> | null = null;

async function ensureFfmpegLoaded(): Promise<void> {
  if (ffmpeg.loaded) return;
  if (!ffmpegLoadPromise) {
    ffmpegLoadPromise = ffmpeg.load().then(() => {});
  }
  await ffmpegLoadPromise;
}

export async function warmAudioConversion(): Promise<void> {
  await ensureFfmpegLoaded();
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

  await ensureFfmpegLoaded();

  // Use simple file names inside ffmpeg FS.
  const inputName = `input.${getAudioExtension(audioBlob.type)}`;
  const outputName = "output.mp3";

  // Convert Blob -> Uint8Array for ffmpeg FS.
  const inputData = new Uint8Array(await audioBlob.arrayBuffer());
  await ffmpeg.writeFile(inputName, inputData);

  try {
    // Voice-focused MP3 output: predictable size, quick encode, clear speech.
    await ffmpeg.exec([
      "-i",
      inputName,
      "-vn",
      "-ac",
      "1",
      "-ar",
      "44100",
      "-acodec",
      "libmp3lame",
      "-b:a",
      "96k",
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
}

export const convertWebmOpusToMp3 = convertAudioBlobToMp3;
