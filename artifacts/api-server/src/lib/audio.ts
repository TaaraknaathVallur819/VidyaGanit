import { gemini } from "./googleAi";
import { Buffer } from "node:buffer";
import { spawn } from "node:child_process";
import { readFile, unlink, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { tmpdir } from "node:os";

export type AudioFormat = "wav" | "mp3" | "webm" | "mp4" | "ogg" | "unknown";

function detectAudioFormat(buffer: Buffer): AudioFormat {
  if (buffer.length < 12) return "unknown";
  if (buffer.subarray(0, 4).toString() === "RIFF") return "wav";
  if (buffer[0] === 0x1a && buffer[1] === 0x45 && buffer[2] === 0xdf && buffer[3] === 0xa3) return "webm";
  if (buffer.subarray(0, 3).toString() === "ID3" || (buffer[0] === 0xff && [0xfb, 0xfa, 0xf3].includes(buffer[1]))) return "mp3";
  if (buffer.subarray(4, 8).toString() === "ftyp") return "mp4";
  if (buffer.subarray(0, 4).toString() === "OggS") return "ogg";
  return "unknown";
}

async function convertToWav(audioBuffer: Buffer): Promise<Buffer> {
  const inputPath = join(tmpdir(), `input-${randomUUID()}`);
  const outputPath = join(tmpdir(), `output-${randomUUID()}.wav`);
  try {
    await writeFile(inputPath, audioBuffer);
    await new Promise<void>((resolve, reject) => {
      const ffmpeg = spawn("ffmpeg", [
        "-i", inputPath, "-vn", "-f", "wav", "-ar", "16000", "-ac", "1",
        "-acodec", "pcm_s16le", "-y", outputPath,
      ]);
      ffmpeg.stderr.on("data", () => {});
      ffmpeg.on("close", (code) => code === 0 ? resolve() : reject(new Error(`ffmpeg exited with code ${code}`)));
      ffmpeg.on("error", reject);
    });
    return await readFile(outputPath);
  } finally {
    await unlink(inputPath).catch(() => {});
    await unlink(outputPath).catch(() => {});
  }
}

export async function ensureCompatibleFormat(
  audioBuffer: Buffer,
): Promise<{ buffer: Buffer; format: "wav" | "mp3" }> {
  const format = detectAudioFormat(audioBuffer);
  if (format === "wav" || format === "mp3") return { buffer: audioBuffer, format };
  return { buffer: await convertToWav(audioBuffer), format: "wav" };
}

/** Transcribe audio through Gemini's multimodal content endpoint. */
export async function speechToText(audioBuffer: Buffer, format: "wav" | "mp3"): Promise<string> {
  const mimeType = format === "mp3" ? "audio/mpeg" : "audio/wav";
  const response = await gemini.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [{
      role: "user",
      parts: [
        { inlineData: { mimeType, data: audioBuffer.toString("base64") } },
        { text: "Transcribe this audio exactly. Return only the spoken words, with no commentary." },
      ],
    }],
    config: { temperature: 0 },
  });
  return response.text?.trim() ?? "";
}