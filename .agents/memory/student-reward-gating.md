---
name: Student-only reward surfaces need requireStudent
description: Why student-reward routes must role-gate the caller, not just validate the opponent
---

Any VidyaGanit route that grants student XP/coins (duels, mock exams) must gate the **caller** with `requireStudent` (mirrors `requireTutor`/`requireParentOrTutor` in `src/middlewares/auth.ts`), not just `requireAuth + requireSelf`.

**Why:** `requireSelf` only checks the cookie identity matches the `:vidyaId` param — it does NOT check role. The duel `challenge` route validated only that the *opponent* was a same-batch student, so a parent/tutor account that happened to have a `batch` value could create duels against students and earn student rewards. Validating the other participant is not enough; gate the actor.

**How to apply:** add `requireStudent` to every student-reward endpoint and add a 403 regression test (see `studentGating.test.ts`). When adding a new student-only feature, copy this guard chain.
