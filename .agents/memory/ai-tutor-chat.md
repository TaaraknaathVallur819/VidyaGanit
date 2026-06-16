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

## Auth / abuse hardening (chat only)
The chat endpoint is gated by `requireAuth` (see `middlewares/auth.ts`): identity comes from a stateless HMAC-signed `vg_session` httpOnly cookie (`lib/session.ts`, signed with `SESSION_SECRET`), set on `/auth/login` + `/auth/register`. The route derives `vidyaId` from the cookie and IGNORES the body `vidyaId` (fixes IDOR/XP-spoofing). Also: in-memory fixed-window rate limits (20/min + 200/hour per identity) and input caps (message ≤1500 chars, history ≤20×2000). Frontend sends `credentials:"include"` and shows friendly 401/429 messages.

**Why same-origin cookies work:** frontend (`/`) and API (`/api`) are one origin via path-based proxy routing, so the cookie auto-flows; no CORS-credentials dance needed.

**Caveats:** (1) users logged in BEFORE cookies existed (localStorage-only) get 401 on chat until they log in once more. (2) The `/profile` endpoint still trusts body `vidyaId` — same IDOR pattern, deliberately left out of scope; revisit if asked. (3) Rate-limit state is per-instance (in-memory) — move to shared store if scaled horizontally.
