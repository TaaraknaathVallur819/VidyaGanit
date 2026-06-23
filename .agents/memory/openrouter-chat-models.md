---
name: OpenRouter chat provider (Perplexity Sonar + DeepSeek)
description: How non-OpenAI/Anthropic/Gemini chat models are reached, and the gotchas that bite when adding them
---

# OpenRouter chat provider

Perplexity Sonar and DeepSeek are reached through **OpenRouter via Replit AI Integrations** (`@workspace/integrations-openrouter-ai`, an OpenAI-compatible client), added as a 4th `ChatProvider` branch in `streamChat`. This is the path for any model OpenAI/Anthropic/Gemini integrations can't serve.

**Why OpenRouter and not direct provider keys:** Replit AI Integrations provisions OpenRouter creds (no user API key, billed to Replit credits). It only proxies **chat completions** — no `/models` list endpoint, no image/audio. So you cannot enumerate available models programmatically; you must probe candidate slugs with a tiny chat completion.

**Slug gotchas (provider catalogs drift without code changes):**
- `perplexity/sonar-reasoning` 404s ("No endpoints found"). The served reasoning slug is `perplexity/sonar-reasoning-pro`.
- Perplexity reasoning models reject a tiny `max_tokens` (return provider 400 "max_tokens must be …"). A 400 here means the slug IS served — distinguish it from a 404 (not served).
- OpenRouter/Perplexity reject OpenAI-only params like `reasoning_effort`; keep the request to the common subset (`max_tokens`, `messages`, `stream`).

**How to apply — adding any chat model:** add to `CHAT_MODELS` (aiChat.ts), both `ChatModelKey` unions (aiChat.ts + AiModelSelect.tsx), both OpenAPI `chatModel` enums, the UI groups, then regen codegen. Two parity guards enforce no drift: `aiChat.test.ts` (catalog ↔ both OpenAPI enums) and `AiModelSelect.test.ts` (UI keys ↔ enum). A key the UI sends that the server doesn't know silently falls back to the default model — no error — which is exactly what these guards catch.

**vitest `@` alias:** component tests that transitively import `@/lib/i18n` need the `@`→`src` alias mirrored in `vitest.config.ts` (vitest does not read `vite.config.ts` resolve aliases here).
