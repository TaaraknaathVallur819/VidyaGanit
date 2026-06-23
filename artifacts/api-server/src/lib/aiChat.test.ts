import { describe, expect, it } from "vitest";
import {
  ChatMessageInputChatModel,
  ConsultantMessageInputChatModel,
} from "@workspace/api-zod";
import { CHAT_MODELS, normalizeChatModel } from "./aiChat";

describe("normalizeChatModel", () => {
  it("resolves every known key to its provider + concrete model id", () => {
    for (const def of CHAT_MODELS) {
      const resolved = normalizeChatModel(def.key);
      expect(resolved.key).toBe(def.key);
      expect(resolved.provider).toBe(def.provider);
      expect(resolved.model).toBe(def.model);
    }
  });

  it("covers all four providers", () => {
    const providers = new Set(CHAT_MODELS.map((m) => m.provider));
    expect(providers).toEqual(
      new Set(["openai", "anthropic", "gemini", "openrouter"]),
    );
  });

  it("defaults to gpt-5-mini for unknown / missing values", () => {
    for (const bad of [undefined, null, "", "gpt-9", 42, {}]) {
      expect(normalizeChatModel(bad).key).toBe("gpt-5-mini");
    }
  });

  // Guards against drift between the OpenAPI contract (regenerated enum) and the
  // server-side catalog. If these fall out of sync, a key the UI can send would
  // silently fall back to the default model.
  it("stays in sync with the OpenAPI chatModel enums", () => {
    const catalogKeys = [...CHAT_MODELS.map((m) => m.key)].sort();
    const chatEnum = Object.values(ChatMessageInputChatModel).sort();
    const consultantEnum = Object.values(ConsultantMessageInputChatModel).sort();
    expect(chatEnum).toEqual(catalogKeys);
    expect(consultantEnum).toEqual(catalogKeys);
  });
});
