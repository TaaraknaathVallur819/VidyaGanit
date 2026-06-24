import { generateImageBuffer } from "@workspace/integrations-openai-ai-server/image";
import { generateImage } from "@workspace/integrations-gemini-ai/image";

/**
 * Selectable image-generation backends for the tutor's inline diagrams.
 * - `openai`                 → OpenAI gpt-image-1 (fast, "low" quality)
 * - `openai-hd`              → OpenAI gpt-image-1 (sharper, "high" quality)
 * - `gemini-nano-banana`     → Gemini "Nano Banana" (gemini-2.5-flash-image)
 * - `gemini-nano-banana-pro` → Gemini "Nano Banana Pro" (gemini-3-pro-image-preview)
 *
 * Claude is intentionally excluded — Anthropic offers no image generation.
 */
export type ImageModel =
  | "openai"
  | "openai-hd"
  | "gemini-nano-banana"
  | "gemini-nano-banana-pro";

const IMAGE_MODELS: readonly ImageModel[] = [
  "openai",
  "openai-hd",
  "gemini-nano-banana",
  "gemini-nano-banana-pro",
];

const GEMINI_MODEL_IDS: Record<
  Exclude<ImageModel, "openai" | "openai-hd">,
  string
> = {
  "gemini-nano-banana": "gemini-2.5-flash-image",
  "gemini-nano-banana-pro": "gemini-3-pro-image-preview",
};

/** Coerce an untrusted value into a known image model, defaulting to OpenAI. */
export function normalizeImageModel(value: unknown): ImageModel {
  return typeof value === "string" && (IMAGE_MODELS as readonly string[]).includes(value)
    ? (value as ImageModel)
    : "openai";
}

/**
 * Generate one illustration for `prompt` with the chosen model and return it as
 * a base64 `data:` URL ready to stream straight to the browser.
 */
export async function generateImageDataUrl(
  model: ImageModel,
  prompt: string,
): Promise<string> {
  if (model === "openai" || model === "openai-hd") {
    // Default `openai` uses "low" quality for the tutor's inline diagrams: they
    // are deliberately simple flat-vector illustrations with short labels, so
    // the lowest quality tier renders an acceptable image while generating
    // noticeably faster (and cheaper) than the default high/auto tier.
    // `openai-hd` opts into "high" quality for a sharper render at the cost of
    // extra latency.
    const quality = model === "openai-hd" ? "high" : "low";
    const buffer = await generateImageBuffer(prompt, "1024x1024", quality);
    return `data:image/png;base64,${buffer.toString("base64")}`;
  }

  const { b64_json, mimeType } = await generateImage(prompt, GEMINI_MODEL_IDS[model]);
  return `data:${mimeType};base64,${b64_json}`;
}
