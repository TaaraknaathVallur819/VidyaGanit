import { Modality } from "@google/genai";
import { gemini } from "./googleAi";

/**
 * Selectable image-generation backends for the tutor's inline diagrams.
 * - `gemini-nano-banana`     → Gemini "Nano Banana" (gemini-2.5-flash-image)
 * - `gemini-nano-banana-pro` → Gemini "Nano Banana Pro" (gemini-3-pro-image-preview)
 */
export type ImageModel =
  | "gemini-nano-banana"
  | "gemini-nano-banana-pro";

const IMAGE_MODELS: readonly ImageModel[] = [
  "gemini-nano-banana",
  "gemini-nano-banana-pro",
];

const GEMINI_MODEL_IDS: Record<ImageModel, string> = {
  "gemini-nano-banana": "gemini-2.5-flash-image",
  "gemini-nano-banana-pro": "gemini-3-pro-image-preview",
};

/** Coerce an untrusted value into a known Gemini image model. */
export function normalizeImageModel(value: unknown): ImageModel {
  return typeof value === "string" && (IMAGE_MODELS as readonly string[]).includes(value)
    ? (value as ImageModel)
    : "gemini-nano-banana";
}

/**
 * Generate one illustration for `prompt` with the chosen model and return it as
 * a base64 `data:` URL ready to stream straight to the browser.
 */
export async function generateImageDataUrl(
  model: ImageModel,
  prompt: string,
): Promise<string> {
  const response = await gemini.models.generateContent({
    model: GEMINI_MODEL_IDS[model],
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    config: { responseModalities: [Modality.TEXT, Modality.IMAGE] },
  });
  const imagePart = response.candidates?.[0]?.content?.parts?.find((part) => part.inlineData?.data);
  const data = imagePart?.inlineData?.data;
  if (!data) throw new Error("No image data in Gemini response");
  return `data:${imagePart.inlineData?.mimeType ?? "image/png"};base64,${data}`;
}
