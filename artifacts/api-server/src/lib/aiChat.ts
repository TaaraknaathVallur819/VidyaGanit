import { gemini } from "./googleAi";

/**
 * Gemini streaming chat abstraction. The student tutor and parent counselor
 * share this path so model selection never changes route logic.
 */
export type ChatProvider = "gemini";

/** Stable key sent by the client (kept in sync with the OpenAPI `chatModel` enum). */
export type ChatModelKey =
  | "gemini-flash-lite-latest";

export interface ChatModelDef {
  /** Client-facing key (matches the OpenAPI enum). */
  key: ChatModelKey;
  /** Which provider branch in `streamChat` handles this model. */
  provider: ChatProvider;
  /** The actual model id sent to the provider's API. */
  model: string;
}

/**
 * Catalog of selectable direct Gemini chat models. The client picks a key and
 * the server resolves it to a provider/model pair for the shared stream path.
 */
export const CHAT_MODELS: readonly ChatModelDef[] = [
  {
    key: "gemini-flash-lite-latest",
    provider: "gemini",
    model: "gemini-flash-lite-latest",
  },
];

/** Default model — the existing client key now routes to direct Gemini. */
const DEFAULT_CHAT_MODEL: ChatModelDef = CHAT_MODELS[0];

/**
 * Coerce an untrusted value into a known chat model.
 *
 * Old clients may still send the previously exposed 2.5 model keys. They are
 * intentionally mapped to the working model instead of being passed through to
 * Gemini, so a remembered selection cannot make chat fail.
 */
export function normalizeChatModel(value: unknown): ChatModelDef {
  if (typeof value === "string") {
    const found = CHAT_MODELS.find((m) => m.key === value);
    if (found) return found;
  }
  return DEFAULT_CHAT_MODEL;
}

/** Normalize model values before request-schema validation for stale clients. */
export function normalizeChatModelInput(value: unknown): unknown {
  if (value === "gemini-2.5-flash" || value === "gemini-2.5-pro") {
    return DEFAULT_CHAT_MODEL.key;
  }
  return value;
}

export interface UnifiedTurn {
  role: "user" | "assistant";
  content: string;
}

export interface ChatImage {
  mimeType: string;
  /** Full data URL: `data:<mime>;base64,...` */
  dataUrl: string;
}

export interface StreamChatInput {
  provider: ChatProvider;
  /** Concrete Gemini model id resolved from a `ChatModelKey`. */
  model: string;
  system: string;
  history: UnifiedTurn[];
  userText: string;
  image?: ChatImage | null;
}

const MAX_OUTPUT_TOKENS = 4096;

function base64FromDataUrl(dataUrl: string): string {
  const idx = dataUrl.indexOf("base64,");
  return idx === -1 ? "" : dataUrl.slice(idx + 7);
}

function fallbackText(userText: string): string {
  return userText || "Please look at the attached image and help me.";
}

/**
 * Stream a chat completion from the chosen provider, yielding plain text deltas.
 * Callers accumulate the deltas and apply their own marker handling.
 */
export async function* streamChat(
  input: StreamChatInput,
): AsyncGenerator<string, void, unknown> {
  const { provider, model, system, history, userText, image } = input;

  type GeminiPart =
    | { text: string }
    | { inlineData: { mimeType: string; data: string } };
  const contents: Array<{ role: "user" | "model"; parts: GeminiPart[] }> =
    history.map((h) => ({
      role: h.role === "assistant" ? "model" : "user",
      parts: [{ text: h.content }],
    }));
  const parts: GeminiPart[] = [{ text: fallbackText(userText) }];
  if (image) {
    parts.push({
      inlineData: {
        mimeType: image.mimeType,
        data: base64FromDataUrl(image.dataUrl),
      },
    });
  }
  contents.push({ role: "user", parts });

  const stream = await gemini.models.generateContentStream({
    model,
    contents,
    config: {
      maxOutputTokens: MAX_OUTPUT_TOKENS,
      systemInstruction: system,
    },
  });
  for await (const part of stream) {
    if (part.text) yield part.text;
  }
}
