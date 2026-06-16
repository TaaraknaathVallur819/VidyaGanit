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
- Rate limiting (`src/middlewares/rateLimit.ts`): 20 messages/min and 200/hour per student (in-memory, single-instance). Message/history size caps are enforced in `routes/chat.ts`.
- Same-origin path routing means the cookie flows automatically between the web app (`/`) and API (`/api`).
- Known follow-ups: the `/profile` endpoint still trusts the body `vidyaId`; rate-limit state would need a shared store if scaled to multiple instances.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
