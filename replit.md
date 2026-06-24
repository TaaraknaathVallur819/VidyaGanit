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
- Uses Replit AI Integrations (managed OpenAI + Gemini). Image models (`aiImage.ts` / `ImageModelSelect.tsx`): `openai` (gpt-image-1, quality "low"/fast), `openai-hd` (gpt-image-1, quality "high"), `gemini-nano-banana` (gemini-2.5-flash-image), `gemini-nano-banana-pro` (gemini-3-pro-image-preview). The inline-illustration default in both student and parent chats is `gemini-nano-banana` for faster drawings. Adding an image model = update the `ImageModel` union in both `aiImage.ts` and `ImageModelSelect.tsx`, both OpenAPI `imageModel` enums, then regen codegen.
- Chat models are pluggable across four providers via the `streamChat` abstraction + `CHAT_MODELS` catalog in `artifacts/api-server/src/lib/aiChat.ts`: OpenAI, Anthropic, Gemini, and OpenRouter (`@workspace/integrations-openrouter-ai`, OpenAI-compatible, used to reach Perplexity Sonar + DeepSeek). The client picks a `ChatModelKey`; the server resolves it to `{provider, model}`. The picker (`AiModelSelect.tsx`) is shared by the student chat and the parent/tutor consultant, so every new model lights up in all three portals at once. Adding a model = add to `CHAT_MODELS`, both `ChatModelKey` unions, both OpenAPI `chatModel` enums, the UI groups, then regen codegen. The catalog↔OpenAPI enum sync is guarded by `aiChat.test.ts`.
- OpenRouter access is via Replit AI Integrations (env: `AI_INTEGRATIONS_OPENROUTER_BASE_URL`, `AI_INTEGRATIONS_OPENROUTER_API_KEY`); only chat completions are supported (no `/models`, no images/audio). Perplexity reasoning is served as `perplexity/sonar-reasoning-pro` (the plain `sonar-reasoning` slug 404s) and requires a non-trivial `max_tokens`.
- Persona/curriculum prompt is built in `artifacts/api-server/src/lib/tutor.ts` (`buildTutorSystemPrompt`), pulling `studentClass`/`board` from `usersTable`.
- The model appends a `[[DRAW: ...]]` marker to request an illustration; the server strips it from the streamed text and emits the image as a base64 data-URL SSE event.
- Required env (provisioned by the integration): `AI_INTEGRATIONS_OPENAI_BASE_URL`, `AI_INTEGRATIONS_OPENAI_API_KEY`.

## Mistake Notebook

- Graded tests now capture the student's chosen option per question (`assessments.submitted_answers`, nullable jsonb int[]) on `POST /api/assessment/submit`.
- `GET /api/assessment/:vidyaId/mistakes` (requireAuth + requireSelf) returns missed questions newest-first, derived on read by `collectMistakes` (`artifacts/api-server/src/lib/assessment.ts`) — there is no separate mistakes table. Only the student's own `status="completed"` tests are exposed; the answer key never leaves the server otherwise.
- UI: `MistakeNotebook.tsx` in the student Progress tab. i18n keys `student.notebook.*` (×23).

## Gamification & engagement features

These 12 features span the student, parent, and tutor portals. Server routes live in `artifacts/api-server/src/routes/gamification.ts` (plus notifications); client components in `artifacts/vidya-ganit/src/components/`. New `usersTable` columns: `coins`, `equippedAvatar`, `equippedTheme`. New tables: `notifications`, `daily_challenge_completions`, `review_items`, `purchases`, `assignments`, `assignment_completions`, `announcements`.

- **Leaderboards** — scope is computed server-side (batch → class → global, surfaced as `data.scope`); the client shows it as a read-only badge and never chooses scope.
- **Daily Challenge** — one per day per student, enforced by `daily_challenge_unique (vidyaId, challengeDate)`. Submit awards XP/coins.
- **Smart Review** — spaced repetition derived over `review_items`.
- **Avatar/reward shop** — coins economy (coins awarded 1:1 with XP); `equippedAvatar`/`equippedTheme` persist the selection; ownership via `purchase_unique`.
- **Concept/formula library**, **Tutor assignments** (`assignment_completion_unique`), **Tutor announcements**, **Class analytics heatmap**, **Notification center** (foundation for inactivity/milestone alerts + assignment/announcement notices).

### Reward-grant concurrency (important)

All coin/XP grants are race-safe — see `gamification.ts`:
- **Idempotent one-time awards** (daily challenge, assignment complete): `insert(...).onConflictDoNothing().returning()` is the source of truth (empty result = already done), with the insert + atomic `sql` XP/coins increment wrapped in one `db.transaction`.
- **Balance debits** (shop buy): `db.transaction` + `SELECT ... FOR UPDATE` (`.for("update")`) row-lock on the user, then ownership/balance checks and an atomic `coins = coins - price`.
- Always use atomic `sql\`${col} + n\`` increments — never read-modify-write. Any new reward path must follow the same patterns.

### i18n caveat for new UI strings

The i18n parity test only checks cross-dict consistency, NOT that component-used keys exist in the dicts. Missing keys silently render as raw key strings while tests stay green. After adding UI strings, verify every `t("...")` key exists in `i18n.tsx` (0-missing grep check) in addition to running the parity test.

## Engagement features (weekly goals, worksheet, flashcards, speed arena, messaging, bookmarks)

Six features spanning the student, parent, and tutor portals. New tables: `weekly_goals`, `bookmarks`, `direct_messages`. Client components in `artifacts/vidya-ganit/src/components/`.

- **Weekly XP goals** — student sets a target (`WeeklyGoal.tsx`); parent sees the child's ring (`ParentWeeklyGoal.tsx`). Progress is derived as `users.xp - startXp` snapshot (no XP ledger); IST week starting Monday.
- **Printable worksheet PDF** (`WorksheetGenerator.tsx` + `src/lib/worksheetPdf.ts`) — tutor/parent only. The endpoint returns an answer key and is gated `requireAuth + requireParentOrTutor`; it must never be reachable by a student. Questions reuse the api-server assessment generator; PDF built client-side via jspdf. **Student-tailored:** the generator uses `useGetLinkedStudents(vidyaId)` to pick a specific linked child, derives their class + board, and constrains the topic dropdown to that class's NCERT curriculum via the client mirror `src/lib/worksheetTopics.ts` (class drives question difficulty server-side; the student name + board are printed in the PDF header). Curriculum is NCERT-common, so board here is a label, not a separate per-board question pool. `worksheetTopics.test.ts` guards class-constraint + i18n-key presence against drift.
- **Formula flashcards** (`FormulaFlashcards.tsx`) — flip cards over the shared client concept catalog `src/lib/concepts.ts` (same source as ConceptLibrary). Purely numeric counters (e.g. "3 / 8") are rendered inline, NOT via i18n keys (the verbatim-English guard flags `{current} / {total}`).
- **Speed math arena** (`SpeedArena.tsx`) — timed mental math; reuses the existing race-safe `/games/score` award path (`game: "speed"`, capped by `MAX_GAME_XP`). No new reward path. A `roundRef` token guards against a stale score-submit response (from a quick "Play Again") overwriting the current round's XP.
- **Tutor⇄parent messaging** (`Messages.tsx`) — 1:1 thread keyed by (tutorVidyaId, parentVidyaId), allowed only when they share a student in `parent_student_links`; receiving a message creates a notification.
- **Student bookmarks** (`BookmarksPanel.tsx`) — save concepts/questions to revisit; toggle lives in `ConceptLibrary.tsx`, which takes an optional `vidyaId` prop (omitted = read-only library).

Server routes: `artifacts/api-server/src/routes/{goals,worksheet,bookmarks,messages}.ts` (+ `src/lib/links.ts`). i18n keys added across all 23 dicts. ConceptLibrary's `vidyaId` prop is optional so tutor previews stay read-only.

## Assessment & engagement features (mock exam, report card, attendance, certificates, duels, meetings)

Six features spanning all three portals. New tables: `mock_exams`, `attendance`, `duels`, `meetings`. Server routes: `artifacts/api-server/src/routes/{mockExam,reportCard,attendance,duels,meetings}.ts`. Client components in `artifacts/vidya-ganit/src/components/`. i18n keys added across all 23 dicts (111 keys).

- **Mock Exam** (`MockExam.tsx`, student) — full-length timed multi-topic paper. `start` creates a `pending` row (questions via `generateMockExam`); `submit` does the pending→completed guarded update + XP/coin increment in ONE transaction (no double-award on resubmit). XP = `XP_PER_CORRECT(5)` × correct. Student-only.
- **Report Card PDF** (`ReportCard.tsx` + `src/lib/reportCardPdf.ts`, parent/tutor) — `GET /report-card/:vidyaId` returns a per-student progress summary (totals, avg, streak, topic breakdown, recent tests); PDF built client-side via jspdf. Parent/tutor pick a linked student.
- **Attendance** (`AttendanceTracker.tsx` tutor marks, `AttendanceView.tsx` parent views) — `attendance` table; tutor-mark routes gated `requireTutor`; parent view is read-only over linked child.
- **Achievement certificates** (`Certificates.tsx` + `src/lib/certificatePdf.ts`, student) — purely client-side: milestones derived from the report-card response (`MILESTONES` array with `unlocked(r)` predicates over totalTests/xp/streakLongest); unlocked ones download a landscape jspdf certificate. No new server route.
- **Peer Math Duel** (`MathDuel.tsx`, student) — async 1v1 vs a same-`batch` classmate. `duels` table holds both sides' answers/scores. Challenge enforces opponent is a student in the same batch; each side's answer write + award is guarded/transactional (participation 10 XP, win bonus +10, tie +5; no double-award per side).
- **Parent–tutor meeting scheduler** (`MeetingScheduler.tsx`, `role="parent"|"tutor"` prop) — `meetings` table; propose/accept/decline/cancel. Gated `requireParentOrTutor` + `sharesStudent(me, counterpart)` so only linked parent↔tutor pairs can schedule. `Meeting.id` is a number → client passes `String(m.id)` to mutation vars.

### Student-only surfaces

`requireStudent` (`src/middlewares/auth.ts`) mirrors `requireTutor`/`requireParentOrTutor`: rejects non-students with 403. Applied to ALL duel and mock-exam routes — without it a parent/tutor with a `batch` value could create duels and earn student rewards. `studentGating.test.ts` guards the 403s. Any new student-reward path must add this guard.

## Auth & abuse controls

- Login/registration are unchanged in flow but now also set a stateless HMAC-signed `vg_session` httpOnly cookie (`src/lib/session.ts`, signed with `SESSION_SECRET`).
- The chat endpoint is gated by `requireAuth` (`src/middlewares/auth.ts`) and derives the student identity from the cookie, never the request body.
- All `/profile/:vidyaId*` routes are gated by `requireAuth` + `requireSelf` (`src/middlewares/auth.ts`): a user can only read/modify their own account (cross-account access → 403). Both dashboards only ever fetch their own profile, so this is transparent.
- Tutor-only surfaces (currently `GET /curriculum/:studentClass`) are gated by `requireAuth` + `requireTutor` (`src/middlewares/auth.ts`): the middleware looks up the authenticated user's `role` and returns 403 for non-tutors, so parents/students can't reach curriculum planning even by calling the API directly. The Curriculum tab itself only renders in `TutorDashboard`.
- Rate limiting (`src/middlewares/rateLimit.ts`): 20 messages/min and 200/hour per student, backed by a shared Postgres table (`rate_limit_buckets`) so limits hold across instances/restarts. Atomic fixed-window via `INSERT ... ON CONFLICT DO UPDATE count = count + 1`. If the DB is unavailable it does NOT fail open — a bounded per-instance in-memory fallback enforces the same limit. Message/history size caps are enforced in `routes/chat.ts`.
- Same-origin path routing means the cookie flows automatically between the web app (`/`) and API (`/api`).

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- After merging schema changes, run `pnpm --filter @workspace/db run push` before the app/tests will work in dev. A `POST /api/auth/register` 500 with `column "..." of relation "users" does not exist` (and matching api-server test failures) means the dev DB is out of sync with the committed Drizzle schema.
- i18n dictionary parity (all 23 languages share identical keys vs. English, no blanks; the ta/hi/te subset additionally must not be verbatim English) is guarded by a permanent vitest test in the web artifact (`artifacts/vidya-ganit/src/lib/i18n.test.ts`). English + ta/hi/te are inline in `i18n.tsx`; the other 19 live in `src/lib/locales/<code>.ts`. Adding any UI string means adding the key to ALL 23 dicts. The `test` validation runs all workspace packages (`pnpm -r --if-present run test`), so this runs in CI alongside the api-server tests.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
