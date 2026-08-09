---
name: Direct Gemini SDK
description: API-server AI features use the standard Google GenAI SDK with a direct Gemini API key
---

The API server intentionally uses `@google/genai` directly with `process.env.GEMINI_API_KEY`; Replit AI Integration base URLs and provider-specific integration wrappers are not part of the runtime path.

**Why:** The application no longer uses Replit AI Integrations and needs a provider-owned SDK/client boundary.

**How to apply:** Keep chat, image generation, and audio transcription behind local server adapters that import the shared direct Gemini client. If adding a new AI capability, do not reintroduce `AI_INTEGRATIONS_*` environment variables or workspace integration wrappers.