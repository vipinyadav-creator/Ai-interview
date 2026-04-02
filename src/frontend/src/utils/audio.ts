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

export async function convertWebmOpusToMp3(webmBlob: Blob): Promise<Blob> {
  if (webmBlob.type === "audio/mpeg") return webmBlob;

  await ensureFfmpegLoaded();

  // Use simple file names inside ffmpeg FS.
  const inputName = "input.webm";
  const outputName = "output.mp3";

  // Convert Blob -> Uint8Array for ffmpeg FS.
  const inputData = new Uint8Array(await webmBlob.arrayBuffer());
  await ffmpeg.writeFile(inputName, inputData);

  try {
    // -q:a controls audio quality; 2 is a good default.
    await ffmpeg.exec([
      "-i",
      inputName,
      "-vn",
      "-acodec",
      "libmp3lame",
      "-q:a",
      "2",
      outputName,
    ]);

    const mp3Data = await ffmpeg.readFile(outputName);
    if (mp3Data instanceof Uint8Array) {
      const mp3ArrayBuffer = mp3Data.buffer as ArrayBuffer;
      return new Blob([mp3ArrayBuffer], { type: "audio/mpeg" });
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
