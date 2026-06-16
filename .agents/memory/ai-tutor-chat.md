---
name: AI tutor chat (VidyaGanit)
description: How the live AI Socratic math tutor + in-chat image generation works and its constraints
---

# VidyaGanit AI tutor chat

The chat endpoint `POST /api/chat/message` (in `artifacts/api-server`) streams Server-Sent Events. It is NOT in the OpenAPI spec (raw SSE, hand-written fetch on the client) — so no Orval codegen applies to it.

## Models / integration
- Uses Replit AI Integrations (managed OpenAI) via `@workspace/integrations-openai-ai-server`. Requires env `AI_INTEGRATIONS_OPENAI_BASE_URL` + `AI_INTEGRATIONS_OPENAI_API_KEY` (provisioned via the integration, not user-supplied).
- Chat: `gpt-5.4` (`chat.completions.create`, `stream:true`, `max_completion_tokens`, NO `temperature` — gpt-5 family rejects it).
- Images: `gpt-image-1` via `generateImageBuffer` (gpt-4o image gen is legacy per the ai-integrations-openai skill).

## SSE contract (keep backward compatible)
Events: `{chunk}` (text), `{drawing:true}`, `{image:"data:image/png;base64,..."}` + `{imageAlt}`, `{imageError:true}`, and terminal `{done,xpAwarded,newBadges}`. The frontend splits the stream buffer on `\n\n`; `JSON.stringify` escapes newlines so a big base64 image stays a single SSE line.

## `[[DRAW: ...]]` marker
The model appends `[[DRAW: <prompt>]]` at the END of a reply when a picture would help. The server must strip it from the streamed text before the client sees it. Streaming stripper withholds only the longest trailing suffix of accumulated text that is a prefix of the literal `"[[DRAW:"` (and everything from a full marker-start onward). This avoids leaking a partial `[[` and avoids permanently stalling on unrelated `[[` (e.g. matrix notation) — unrelated text is released on the next chunk.

## Known limitation (out of scope, flagged to user)
The endpoint trusts a caller-supplied `vidyaId` with no authenticated identity check — a pre-existing app-wide pattern. Now that paid LLM/image calls hang off it, it is an abuse/cost vector. Adding real authz + rate limiting was deliberately NOT done (task scoped auth as untouched). Revisit if hardening is requested.
