import { describe, expect, it } from "vitest";
import {
  ChatMessageInputChatModel,
  ConsultantMessageInputChatModel,
} from "@workspace/api-zod";
import {
  CHAT_MODELS,
  normalizeChatModel,
  normalizeChatModelInput,
} from "./aiChat";

describe("normalizeChatModel", () => {
  it("resolves every known key to its provider + concrete model id", () => {
    for (const def of CHAT_MODELS) {
      const resolved = normalizeChatModel(def.key);
      expect(resolved.key).toBe(def.key);
      expect(resolved.provider).toBe(def.provider);
      expect(resolved.model).toBe(def.model);
    }
  });

  it("uses direct Gemini for every selectable model", () => {
    const providers = new Set(CHAT_MODELS.map((m) => m.provider));
    expect(providers).toEqual(new Set(["gemini"]));
  });

  it("defaults to the supported Gemini Flash Lite model for unknown / missing values", () => {
    for (const bad of [undefined, null, "", "gpt-9", 42, {}]) {
      expect(normalizeChatModel(bad).key).toBe("gemini-flash-lite-latest");
    }
  });

  it("maps legacy unavailable Gemini selections to the supported model", () => {
    for (const legacy of ["gemini-2.5-flash", "gemini-2.5-pro"]) {
      expect(normalizeChatModel(legacy).key).toBe("gemini-flash-lite-latest");
      expect(normalizeChatModel(legacy).model).toBe("gemini-flash-lite-latest");
      expect(normalizeChatModelInput(legacy)).toBe("gemini-flash-lite-latest");
    }
  });

  it("leaves current and unrelated request values unchanged", () => {
    expect(normalizeChatModelInput("gemini-flash-lite-latest")).toBe(
      "gemini-flash-lite-latest",
    );
    expect(normalizeChatModelInput(undefined)).toBeUndefined();
    expect(normalizeChatModelInput("other-model")).toBe("other-model");
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
