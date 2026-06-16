---
name: AI tutor chat (VidyaGanit)
description: How the live AI Socratic math tutor + in-chat image generation works and its constraints
---

# VidyaGanit AI tutor chat

The chat endpoint `POST /api/chat/message` (in `artifacts/api-server`) streams Server-Sent Events. It is NOT in the OpenAPI spec (raw SSE, hand-written fetch on the client) — so no Orval codegen applies to it.

## Models / integration
- Uses Replit AI Integrations (managed OpenAI) via `@workspace/integrations-openai-ai-server`. Requires env `AI_INTEGRATIONS_OPENAI_BASE_URL` + `AI_INTEGRATIONS_OPENAI_API_KEY` (provisioned via the integration, not user-supplied).
- Chat: `gpt-5-mini` (`chat.completions.create`, `stream:true`, `max_completion_tokens`, NO `temperature` — gpt-5 family rejects it). **Why mini:** chosen for low chat latency for kids + credit conservation while keeping Socratic quality. Do NOT switch to `gpt-4o-mini` (flagged legacy in the ai-integrations-openai skill) or Gemini (not available through this OpenAI integration). `gpt-5-nano` is the faster/cheaper fallback if even more speed is needed; `gpt-5.4` is the higher-quality but slower option.
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

## Compliance logging (Parent Dashboard groundwork)
Every tutor turn is persisted append-only to `chat_messages` (sessionId, studentVidyaId→users.vidyaId, role, content, createdAt). Keyed by the cookie-derived `vidyaId`, never the body. The client sends a `sessionId` (added as optional to OpenAPI `ChatMessageInput`) generated per conversation and regenerated on "clear chat". Inserts are best-effort (wrapped in try/catch + `req.log.error`) so a logging failure never breaks the live chat. The AI-failure fallback message shown to the child is also persisted (so the audit log matches what was displayed). NOT persisted: client-only input-sanitizer nudges (they never reach the server — deliberate scope choice).

## Topical guardrail
`buildTutorSystemPrompt` (`lib/tutor.ts`) has a strict "TOPIC GUARDRAIL" block: refuse all non-maths queries (movies, games, stories, code, etc.) and playfully redirect to maths. This is prompt-only; there is no server-side topic classifier.

## No-spoon-feeding rule
`buildTutorSystemPrompt` also has a "NO SPOON-FEEDING" block as strict as the Golden Rule: when working the student's OWN problem the coach must never write the fraction for them, never state the numerator/denominator value, and never give the exact divisor/HCF — it must ask open questions so the student produces each number. It MAY still teach with a different illustrative example using other numbers. (Added after live testing showed the AI handing over "4/8" and "divide by 4".)

## File attachments (paperclip + camera)
Students can attach ANY file type to a chat message (paperclip = `accept="*/*"`, camera = `accept="image/*" capture="environment"`). Client reads the file via `FileReader` → base64 data URL and sends it as an optional `attachment {name, mimeType, dataUrl}` in the JSON body (added to OpenAPI `ChatMessageInput` → regenerated `SendChatMessageBody`). Server (`routes/chat.ts`): images → multimodal `image_url` content for vision; readable text (text/csv/json/xml/yaml) → decoded + inlined; other binary (pdf/docx) → coach describes the file and asks the student to photograph/retype. A message may be sent with an attachment and EMPTY text; gibberish `validateStudentInput` is skipped when an attachment is present.

**GOTCHA — body size limit:** attachments are big base64 data URLs (cap ~8MB → ~11.5MB encoded, `MAX_ATTACHMENT_DATAURL_LEN`). Express's default `express.json()` limit is ~100kb, which silently rejects real attachments with 413 before the route runs. `app.ts` therefore applies a route-scoped `express.json({ limit: "12mb" })` ONLY for `/api/chat/message`; every other route keeps the small default to limit abuse. The route handler also enforces its own size cap as second-line defense. **Why:** if you ever add another upload endpoint, give it its own large-limit parser — do NOT raise the global limit.

## Voice input (mic button)
The mic uses the browser **Web Speech API** (`window.SpeechRecognition ?? window.webkitSpeechRecognition`), `lang="en-IN"`, interim results streamed live into the text input box; toggle start/stop with a red pulsing indicator; friendly errors for unsupported browser / `not-allowed` / `no-speech`; `recognition.start()` wrapped in try/catch (edge `InvalidStateError`); aborted on unmount. TS DOM lib here lacks the types — ambient declarations live in `src/types/speech.d.ts`. Voice goes through the SAME message path as typed text, so the existing TOPIC GUARDRAIL (math-only) and `validateStudentInput` apply automatically; no separate guardrail needed. **Env caveat:** mic + camera need iframe permission policy (`allow="microphone; camera"`) — they fail in restrictive embeds (e.g. the canvas iframe); best tested in the real preview/published tab. This is environment-controlled, not app-logic.

## GOTCHA — Fast Refresh & mixed exports (caused "buttons not working")
`SocraticChat.tsx` previously exported BOTH a constant (`BADGE_CATALOG`) and the default component. react-refresh requires a file to export ONLY components to hot-patch it; the mixed export made every edit fail Fast Refresh ("export is incompatible") and fall back to a full reload that sometimes left STALE code in the browser — so newly-wired buttons appeared "not working" until a hard refresh. **Fix/rule:** keep non-component exports (constants, types, helpers) OUT of component files — `BADGE_CATALOG` now lives in `src/lib/badges.ts`. **Why it matters:** symptom looks like a broken feature but is really stale HMR; check the vite HMR logs for `invalidate ... Could not Fast Refresh` before debugging the feature code.

## Frontend input sanitizer
`validateStudentInput` in `SocraticChat.tsx` intercepts gibberish/emoji-spam BEFORE calling the API and shows a friendly nudge. **Must stay Unicode-aware:** the "has meaning" check uses `/[\p{L}\p{N}]/u` (+ maths operators), NOT `[a-zA-Z0-9]` — an ASCII-only check wrongly blocks Hindi/Tamil/Devanagari input, a real break for this Indian-student app. Repeated-char/keyboard-mash heuristics are intentionally ASCII-only so they don't false-positive on Indic scripts.
