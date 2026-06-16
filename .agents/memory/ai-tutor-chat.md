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

Profile routes (`/profile/:vidyaId*`) are now also gated by `requireAuth` + `requireSelf` (ownership: `req.vidyaId === req.params.vidyaId`, else 403) — same IDOR class fixed there. Safe because both dashboards only fetch their own `vidyaId`.

Rate limiting is backed by a shared Postgres table `rate_limit_buckets` (fixed-window, key=`prefix:identity:windowStart`, atomic `INSERT ... ON CONFLICT DO UPDATE count = count + 1`), so limits hold across instances/restarts. **Does NOT fail open:** on DB error it falls back to a bounded per-instance in-memory limiter (cost protection must survive DB outages — flagged in review). 

**Note:** the chat body Zod schema still *requires* `vidyaId`, but the value is IGNORED for identity (cookie wins). The frontend still sends it; don't rely on it server-side.

**Caveat:** users logged in BEFORE cookies existed (localStorage-only) get 401 on chat until they log in once more.
