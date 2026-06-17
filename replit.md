# [Project name]

_Replace the heading above with the project's name, and this line with one sentence describing what this app does for users._

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

_Populate as you build — short repo map plus pointers to the source-of-truth file for DB schema, API contracts, theme files, etc._

## Architecture decisions

_Populate as you build — non-obvious choices a reader couldn't infer from the code (3-5 bullets)._

## Product

VidyaGanit is a Socratic math tuition web app for Indian school kids (Classes 4–7). The core feature is a live AI "Math Coach" chatbot that never gives the final answer — it guides students one step at a time with playful, India-flavoured hints (pizza/cricket/rupees), tailored to the student's Class & Board. When a picture would help, the coach draws an illustration inline in the chat. Students earn XP and badges as they work.

## AI tutor chat

- Endpoint: `POST /api/chat/message` in `artifacts/api-server` — a Server-Sent Events stream (not in the OpenAPI spec; hand-written SSE + raw `fetch` on the client in `artifacts/vidya-ganit/src/components/SocraticChat.tsx`).
- Uses Replit AI Integrations (managed OpenAI) via `@workspace/integrations-openai-ai-server`. Chat model `gpt-5.4`; image model `gpt-image-1`.
- Persona/curriculum prompt is built in `artifacts/api-server/src/lib/tutor.ts` (`buildTutorSystemPrompt`), pulling `studentClass`/`board` from `usersTable`.
- The model appends a `[[DRAW: ...]]` marker to request an illustration; the server strips it from the streamed text and emits the image as a base64 data-URL SSE event.
- Required env (provisioned by the integration): `AI_INTEGRATIONS_OPENAI_BASE_URL`, `AI_INTEGRATIONS_OPENAI_API_KEY`.

## Auth & abuse controls

- Login/registration are unchanged in flow but now also set a stateless HMAC-signed `vg_session` httpOnly cookie (`src/lib/session.ts`, signed with `SESSION_SECRET`).
- The chat endpoint is gated by `requireAuth` (`src/middlewares/auth.ts`) and derives the student identity from the cookie, never the request body.
- All `/profile/:vidyaId*` routes are gated by `requireAuth` + `requireSelf` (`src/middlewares/auth.ts`): a user can only read/modify their own account (cross-account access → 403). Both dashboards only ever fetch their own profile, so this is transparent.
- Rate limiting (`src/middlewares/rateLimit.ts`): 20 messages/min and 200/hour per student, backed by a shared Postgres table (`rate_limit_buckets`) so limits hold across instances/restarts. Atomic fixed-window via `INSERT ... ON CONFLICT DO UPDATE count = count + 1`. If the DB is unavailable it does NOT fail open — a bounded per-instance in-memory fallback enforces the same limit. Message/history size caps are enforced in `routes/chat.ts`.
- Same-origin path routing means the cookie flows automatically between the web app (`/`) and API (`/api`).

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- After merging schema changes, run `pnpm --filter @workspace/db run push` before the app/tests will work in dev. A `POST /api/auth/register` 500 with `column "..." of relation "users" does not exist` (and matching api-server test failures) means the dev DB is out of sync with the committed Drizzle schema.
- i18n dictionary parity (all 23 languages share identical keys vs. English, no blanks; the ta/hi/te subset additionally must not be verbatim English) is guarded by a permanent vitest test in the web artifact (`artifacts/vidya-ganit/src/lib/i18n.test.ts`). English + ta/hi/te are inline in `i18n.tsx`; the other 19 live in `src/lib/locales/<code>.ts`. Adding any UI string means adding the key to ALL 23 dicts. The `test` validation runs all workspace packages (`pnpm -r --if-present run test`), so this runs in CI alongside the api-server tests.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
