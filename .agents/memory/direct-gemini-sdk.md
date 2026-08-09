---
name: Direct Gemini SDK
description: API-server AI features use the standard Google GenAI SDK with a direct Gemini API key
---

The API server intentionally uses `@google/genai` directly with `process.env.GEMINI_API_KEY`; Replit AI Integration base URLs and provider-specific integration wrappers are not part of the runtime path. The current key successfully supports `gemini-flash-lite-latest`; the previously exposed 2.5 chat models may be unavailable or quota-limited for this account.

**Why:** The application no longer uses Replit AI Integrations and needs a provider-owned SDK/client boundary.

**How to apply:** Keep chat, image generation, and audio transcription behind local server adapters that import the shared direct Gemini client. Keep the public chat catalog on models verified against the current key, and map stale client model selections to the supported default. If adding a new AI capability, do not reintroduce `AI_INTEGRATIONS_*` environment variables or workspace integration wrappers.