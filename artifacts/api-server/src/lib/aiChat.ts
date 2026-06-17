import type OpenAI from "openai";
import { openai } from "@workspace/integrations-openai-ai-server";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import { ai as gemini } from "@workspace/integrations-gemini-ai";

/**
 * Multi-provider streaming chat abstraction. The student tutor and the parent
 * counselor both speak through this so a single `provider` field switches the
 * underlying model without changing any route logic. Image generation (the
 * `[[DRAW:]]` flow) stays on OpenAI and is handled by the routes directly.
 */
export type ChatProvider = "openai" | "anthropic" | "gemini";

export const CHAT_PROVIDERS: readonly ChatProvider[] = [
  "openai",
  "anthropic",
  "gemini",
];

/** Coerce an untrusted value into a valid provider, defaulting to OpenAI. */
export function normalizeProvider(value: unknown): ChatProvider {
  return value === "anthropic" || value === "gemini" ? value : "openai";
}

const MODEL_BY_PROVIDER: Record<ChatProvider, string> = {
  openai: "gpt-5-mini",
  anthropic: "claude-sonnet-4-6",
  gemini: "gemini-2.5-flash",
};

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
  system: string;
  history: UnifiedTurn[];
  userText: string;
  image?: ChatImage | null;
}

const MAX_OUTPUT_TOKENS = 8192;

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
  const { provider, system, history, userText, image } = input;
  const model = MODEL_BY_PROVIDER[provider];

  if (provider === "anthropic") {
    type AnthropicMediaType =
      | "image/jpeg"
      | "image/png"
      | "image/gif"
      | "image/webp";
    type AnthropicContent =
      | string
      | Array<
          | { type: "text"; text: string }
          | {
              type: "image";
              source: {
                type: "base64";
                media_type: AnthropicMediaType;
                data: string;
              };
            }
        >;
    const messages: Array<{
      role: "user" | "assistant";
      content: AnthropicContent;
    }> = history.map((h) => ({ role: h.role, content: h.content }));
    if (image) {
      messages.push({
        role: "user",
        content: [
          { type: "text", text: fallbackText(userText) },
          {
            type: "image",
            source: {
              type: "base64",
              media_type: image.mimeType as AnthropicMediaType,
              data: base64FromDataUrl(image.dataUrl),
            },
          },
        ],
      });
    } else {
      messages.push({ role: "user", content: userText });
    }

    const stream = anthropic.messages.stream({
      model,
      max_tokens: MAX_OUTPUT_TOKENS,
      system,
      messages,
    } as Parameters<typeof anthropic.messages.stream>[0]);
    for await (const event of stream) {
      if (
        event.type === "content_block_delta" &&
        event.delta.type === "text_delta"
      ) {
        yield event.delta.text;
      }
    }
    return;
  }

  if (provider === "gemini") {
    type GeminiPart =
      | { text: string }
      | { inlineData: { mimeType: string; data: string } };
    const contents: Array<{ role: string; parts: GeminiPart[] }> = history.map(
      (h) => ({
        role: h.role === "assistant" ? "model" : "user",
        parts: [{ text: h.content }],
      }),
    );
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
      config: { maxOutputTokens: MAX_OUTPUT_TOKENS, systemInstruction: system },
    } as Parameters<typeof gemini.models.generateContentStream>[0]);
    for await (const chunk of stream) {
      if (chunk.text) yield chunk.text;
    }
    return;
  }

  // Default: OpenAI.
  let userContent: OpenAI.Chat.Completions.ChatCompletionUserMessageParam["content"];
  if (image) {
    userContent = [
      { type: "text", text: fallbackText(userText) },
      { type: "image_url", image_url: { url: image.dataUrl } },
    ];
  } else {
    userContent = userText;
  }

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: system },
    ...history.map(
      (h): OpenAI.Chat.Completions.ChatCompletionMessageParam =>
        h.role === "assistant"
          ? { role: "assistant", content: h.content }
          : { role: "user", content: h.content },
    ),
    { role: "user", content: userContent },
  ];

  const stream = await openai.chat.completions.create({
    model,
    reasoning_effort: "low",
    max_completion_tokens: MAX_OUTPUT_TOKENS,
    stream: true,
    messages,
  });
  for await (const part of stream) {
    const content = part.choices[0]?.delta?.content;
    if (content) yield content;
  }
}
