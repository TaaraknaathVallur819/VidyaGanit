import type OpenAI from "openai";
import { openai } from "@workspace/integrations-openai-ai-server";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import { ai as gemini } from "@workspace/integrations-gemini-ai";
import { openrouter } from "@workspace/integrations-openrouter-ai";

/**
 * Multi-provider streaming chat abstraction. The student tutor and the parent
 * counselor both speak through this so a single `provider` field switches the
 * underlying model without changing any route logic. Image generation (the
 * `[[DRAW:]]` flow) stays on OpenAI and is handled by the routes directly.
 *
 * `openrouter` is an OpenAI-compatible chat-completions endpoint used to reach
 * providers the other integrations can't (DeepSeek, Perplexity Sonar).
 */
export type ChatProvider = "openai" | "anthropic" | "gemini" | "openrouter";

/** Stable key sent by the client (kept in sync with the OpenAPI `chatModel` enum). */
export type ChatModelKey =
  | "gpt-5.4"
  | "gpt-5-mini"
  | "gpt-5-nano"
  | "claude-opus-4-8"
  | "claude-sonnet-4-6"
  | "claude-haiku-4-5"
  | "gemini-3-pro"
  | "gemini-3-flash"
  | "gemini-2.5-flash"
  | "perplexity-sonar"
  | "perplexity-sonar-pro"
  | "perplexity-sonar-reasoning"
  | "deepseek-chat-v3"
  | "deepseek-r1";

export interface ChatModelDef {
  /** Client-facing key (matches the OpenAPI enum). */
  key: ChatModelKey;
  /** Which provider branch in `streamChat` handles this model. */
  provider: ChatProvider;
  /** The actual model id sent to the provider's API. */
  model: string;
}

/**
 * Catalog of selectable chat models across all three providers. The client picks
 * a `key`; the server resolves it to a `{provider, model}` pair so a single field
 * switches the underlying model without changing any route logic.
 */
export const CHAT_MODELS: readonly ChatModelDef[] = [
  { key: "gpt-5.4", provider: "openai", model: "gpt-5.4" },
  { key: "gpt-5-mini", provider: "openai", model: "gpt-5-mini" },
  { key: "gpt-5-nano", provider: "openai", model: "gpt-5-nano" },
  { key: "claude-opus-4-8", provider: "anthropic", model: "claude-opus-4-8" },
  { key: "claude-sonnet-4-6", provider: "anthropic", model: "claude-sonnet-4-6" },
  { key: "claude-haiku-4-5", provider: "anthropic", model: "claude-haiku-4-5" },
  { key: "gemini-3-pro", provider: "gemini", model: "gemini-3.1-pro-preview" },
  { key: "gemini-3-flash", provider: "gemini", model: "gemini-3-flash-preview" },
  { key: "gemini-2.5-flash", provider: "gemini", model: "gemini-2.5-flash" },
  {
    key: "perplexity-sonar",
    provider: "openrouter",
    model: "perplexity/sonar",
  },
  {
    key: "perplexity-sonar-pro",
    provider: "openrouter",
    model: "perplexity/sonar-pro",
  },
  {
    key: "perplexity-sonar-reasoning",
    provider: "openrouter",
    model: "perplexity/sonar-reasoning-pro",
  },
  {
    key: "deepseek-chat-v3",
    provider: "openrouter",
    model: "deepseek/deepseek-chat-v3.1",
  },
  { key: "deepseek-r1", provider: "openrouter", model: "deepseek/deepseek-r1" },
];

/** Default model — kept on gpt-5-mini for low chat latency + credit conservation. */
const DEFAULT_CHAT_MODEL: ChatModelDef = CHAT_MODELS[1];

/** Coerce an untrusted value into a known chat model, defaulting to gpt-5-mini. */
export function normalizeChatModel(value: unknown): ChatModelDef {
  if (typeof value === "string") {
    const found = CHAT_MODELS.find((m) => m.key === value);
    if (found) return found;
  }
  return DEFAULT_CHAT_MODEL;
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
  /** Concrete provider model id (resolved from a `ChatModelKey` via `normalizeChatModel`). */
  model: string;
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
  const { provider, model, system, history, userText, image } = input;

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

  if (provider === "openrouter") {
    // OpenAI-compatible chat completions (DeepSeek, Perplexity Sonar). Sonar
    // models are text-only and these providers reject OpenAI-specific params
    // like `reasoning_effort`, so keep the request to the common subset.
    let orUserContent: OpenAI.Chat.Completions.ChatCompletionUserMessageParam["content"];
    if (image) {
      orUserContent = [
        { type: "text", text: fallbackText(userText) },
        { type: "image_url", image_url: { url: image.dataUrl } },
      ];
    } else {
      orUserContent = userText;
    }

    const orMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: "system", content: system },
      ...history.map(
        (h): OpenAI.Chat.Completions.ChatCompletionMessageParam =>
          h.role === "assistant"
            ? { role: "assistant", content: h.content }
            : { role: "user", content: h.content },
      ),
      { role: "user", content: orUserContent },
    ];

    const stream = await openrouter.chat.completions.create({
      model,
      max_tokens: MAX_OUTPUT_TOKENS,
      stream: true,
      messages: orMessages,
    });
    for await (const part of stream) {
      const content = part.choices[0]?.delta?.content;
      if (content) yield content;
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
