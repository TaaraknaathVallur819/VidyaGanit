import { describe, expect, it } from "vitest";
import { ChatMessageInputChatModel } from "@workspace/api-zod";
import { CHAT_MODEL_KEYS } from "./AiModelSelect";

// Guards against drift between the model picker the UI renders and the OpenAPI
// `chatModel` contract. If a UI option's key isn't in the enum, the server
// silently falls back to the default model — a bug the user would never see as
// an error. The backend has the mirror of this guard in aiChat.test.ts.
describe("AiModelSelect", () => {
  it("offers exactly the keys in the OpenAPI chatModel enum", () => {
    const uiKeys = [...CHAT_MODEL_KEYS].sort();
    const enumKeys = Object.values(ChatMessageInputChatModel).sort();
    expect(uiKeys).toEqual(enumKeys);
  });

  it("has no duplicate options", () => {
    expect(new Set(CHAT_MODEL_KEYS).size).toBe(CHAT_MODEL_KEYS.length);
  });
});
