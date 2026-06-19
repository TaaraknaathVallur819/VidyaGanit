---
name: Student-linking authorization (VidyaGanit)
description: Why the parent/tutor link endpoints need a role gate beyond requireSelf, plus batches/bulk-add/report-export shape
---

# Linking students to an account

Linking/unlinking students lives on `/profile/:vidyaId/link-student(s)` routes in `artifacts/api-server/src/routes/profile.ts`. These create rows in `parent_student_links`, and the parent/tutor dashboards' per-student access is gated by membership in that table.

**Rule:** every link/unlink route must run `requireParentOrTutor` (in `middlewares/auth.ts`) in addition to `requireAuth + requireSelf`.

**Why:** `requireSelf` only proves the caller owns the account named in the URL — it does NOT prove the caller is a parent/tutor. Without the role gate, an authenticated *student* can `POST /profile/<their-own-id>/link-students` and attach arbitrary student IDs to their own account, then pass the parent-route linkage checks that read `parent_student_links`. This is a broken-access-control hole (flagged in review). The role gate returns 403 for students.

**How to apply:** if you add any new endpoint that writes `parent_student_links`, gate it with `requireParentOrTutor`. There are role-denial tests in `profile.test.ts` (student forbidden on single/bulk link + unlink; parent/tutor allowed).

## Multi-batch + bulk-add + report export (feature shape)
- Tutors register with MULTIPLE batches: `users.batches text[]` (new) alongside legacy `users.batch` (kept; first batch mirrored into it). `parent_student_links.batch text` records a student's batch.
- Bulk link endpoint `POST /profile/:vidyaId/link-students` resolves each ID independently → per-ID status (`linked`/`already_linked`/`not_found`/`not_a_student`/`self`); one bad ID never aborts the batch; capped at `MAX_BULK_LINK=100`. Shared client component `BulkAddStudents.tsx` (used by both dashboards; tutor passes `batches`, parent does not).
- Tutor batch filter in `TutorDashboard`: a `batchFilter` state drives `filteredStudents`, which MUST feed BOTH the Students-tab roster AND the progress/history student picker (and the default-selection effect) — a partial application that only filters the picker is a bug. `UNASSIGNED_BATCH = "__unassigned__"` is the sentinel for students with no batch.
- Report export: shared `src/lib/exportReport.ts` (`exportReportPdf`/`exportReportCsv`, jspdf + jspdf-autotable) built from analytics + assessments only — NOT xp/badges, because `requireSelf` blocks a parent/tutor from fetching a student's own profile. Buttons live in `ProgressAnalytics.tsx` (shared by both dashboards). CSV uses a UTF-8 BOM.

**Import gotcha:** generated API types (e.g. `UserProfile`, `StudentAnalytics`, `AssessmentSummary`, `BulkLinkResult`) are exported from `@workspace/api-client-react`. There is NO `@workspace/api-zod` package — importing from it fails typecheck.
