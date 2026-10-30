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
- The API server uses the direct `@google/genai` SDK through `src/lib/googleAi.ts`, authenticated with `process.env.GEMINI_API_KEY`; no Replit AI Integration base URL is used. Chat supports Gemini 2.5 Flash and Pro, inline diagrams use Gemini image models, and parent audio transcription uses Gemini multimodal input.
- Persona/curriculum prompt is built in `artifacts/api-server/src/lib/tutor.ts` (`buildTutorSystemPrompt`), pulling `studentClass`/`board` from `usersTable`.
- The model appends a `[[DRAW: ...]]` marker to request an illustration; the server strips it from the streamed text and emits the image as a base64 data-URL SSE event.
- Required env: `GEMINI_API_KEY`.

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

## Payments & paid plans (Razorpay)

- Two plans, defined in `artifacts/api-server/src/lib/paymentCatalog.ts` (the source of truth for prices): **Family Plus** (parents, Rs 1,000/month or Rs 9,000/year (25% off yearly)) and **Tutor Pro** (tutors, Rs 2,000/month or Rs 18,000/year (25% off yearly)). The same numbers appear in `PricingSection.tsx` and `SubscriptionPlanCard.tsx`; keep all three in step.
- Premium features are locked **server-side** with `requirePlan("<featureKey>")` (`lib/planAccess.ts`), which answers HTTP 402 `{ code: "PLAN_REQUIRED", plan, feature, featureKey }`. The web client turns any such 402 into an upgrade toast in the person's language (`vg:plan-required` event from `custom-fetch.ts`), and the premium dashboard tabs are wrapped in `<PremiumGate>`. The UI is only the experience layer; the API is what enforces the lock.
- Locked today: Strategy AI / AI Coach (the shared `/parent/:id/consultant/*` endpoints), weekly digest, worksheets, report cards viewed by a parent or tutor (a student always sees their own), class heatmap, class weak-spot worksheets (`GET /tutor/:id/weak-topics`), connecting a payout account and paying a tutor online (the tutor needs Tutor Pro), and the link limits below.
- Limits live in one place, `FREE_LIMITS` / `PAID_LIMITS` in `planAccess.ts`: a free parent links 1 child (Family Plus: 4), a free tutor links 5 students (Tutor Pro: unlimited), a free student gets 5 games a day (unlimited when a linked parent has Family Plus or a linked tutor has Tutor Pro; counted in `rate_limit_buckets`, resets at midnight IST). Existing links are never removed when a plan lapses.
- Free: everything else a student does, the basic monitoring views (analytics, history, assessments, recommendations, attendance) and the fee ledger. To move a feature between free and paid, add or remove `requirePlan(...)` on its route and the matching `<PremiumGate>` in the dashboard.
- Access means a `subscriptions` row with status `Success` and a `current_end` in the future. Rows whose `provider_plan_id` is a placeholder id (`plan_family_plus_monthly`, ...) never count, and `demo_...` rows count only while demo mode is on.
- **Payment modes** (`paymentsMode()` in `lib/razorpay.ts`, reported to the UI as `mode`):
  - `live`: `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` are set. Real keys always win. `rzp_test_...` keys give Razorpay's own test mode (test cards, no real money).
  - `demo`: `PAYMENTS_DEMO_MODE=true` and no real keys. The built-in demo checkout activates a plan for 24 hours with no money and no signatures (`POST .../subscriptions/demo-confirm`, `.../orders/:id/demo-confirm`). It is a deliberate free pass for trying the flow, so switch it off afterwards; switching it off, or adding real keys, ends every demo plan at once.
  - `off` (default): nothing is configured, every payment action answers 503 `PAYMENTS_UNAVAILABLE` and premium stays locked. There is deliberately no dummy-key fallback: the old one used a secret published in this repo.
  - `mock`: `RAZORPAY_MOCK=true`, for local development and tests only; ignored when `NODE_ENV=production`.
- Render env vars (service `vidyaganit-api`): `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, the four plan ids `RAZORPAY_PLAN_FAMILY_PLUS_MONTHLY`, `RAZORPAY_PLAN_FAMILY_PLUS_YEARLY`, `RAZORPAY_PLAN_TUTOR_PRO_MONTHLY`, `RAZORPAY_PLAN_TUTOR_PRO_YEARLY` (create the plans in the Razorpay dashboard with amounts matching the catalog), and optionally `PAYMENTS_DEMO_MODE` and `SUPPORT_EMAIL` (the address Tutor Pro members see for priority support; you must answer it).
- Razorpay webhook: `POST https://www.vidyaganit.com/api/payments/webhook`, secret = `RAZORPAY_WEBHOOK_SECRET`, events `subscription.activated`, `.charged`, `.resumed`, `.cancelled`, `.completed`, `.halted`, `.paused`, plus `payment.captured` and `payment.failed`. Tutor payouts need Razorpay Route enabled on the account.
- Fee payments are written to the fee ledger with one of its allowed methods (`upi`, `card`, `bank_transfer`, `other`), never a free-text value: the ledger response is validated against that enum.
- Shared client code: `lib/payments.ts` runs the whole create / pay / confirm journey for the pricing page, the plan card and the fee page. Never reimplement it in a component.
- Tests: `lib/planAccess.test.ts`, `lib/razorpay.test.ts` and `routes/premiumLocks.test.ts` use a scripted fake `db` (`lib/testDb.ts`) and need no database.
- i18n: the upgrade, demo, WhatsApp and weak-spot strings are in all 23 dictionaries. Bodo, Kashmiri, Manipuri and Santali only have `wa.classLabel` translated (the rest is English) because those locale files translate almost nothing yet and payment wording must not be guessed. The other 18 were written without a native reviewer; have them checked before relying on them.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- After merging schema changes, run `pnpm --filter @workspace/db run push` before the app/tests will work in dev. A `POST /api/auth/register` 500 with `column "..." of relation "users" does not exist` (and matching api-server test failures) means the dev DB is out of sync with the committed Drizzle schema.
- i18n dictionary parity (all 23 languages share identical keys vs. English, no blanks; the ta/hi/te subset additionally must not be verbatim English) is guarded by a permanent vitest test in the web artifact (`artifacts/vidya-ganit/src/lib/i18n.test.ts`). English + ta/hi/te are inline in `i18n.tsx`; the other 19 live in `src/lib/locales/<code>.ts`. Adding any UI string means adding the key to ALL 23 dicts. The `test` validation runs all workspace packages (`pnpm -r --if-present run test`), so this runs in CI alongside the api-server tests.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
