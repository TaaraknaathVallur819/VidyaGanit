---
name: Six engagement features (weekly goals, worksheet, flashcards, speed arena, messaging, bookmarks)
description: Non-obvious design decisions behind the 6-feature engagement wave for VidyaGanit
---

# Weekly XP goals
- Progress is derived as `users.xp - startXp` snapshot taken at goal-set time — there is no XP ledger/event table. Week boundary is IST, week starts Monday.
- **Why:** XP is a running counter; snapshotting the start avoids needing per-event history just to show weekly delta.

# Printable worksheet PDF
- The worksheet endpoint returns an answer key and MUST stay gated `requireAuth + requireParentOrTutor`. The answer key must never be reachable by a student account.
- **Why:** same leak risk as the assessment answer key — students could fetch the API directly.
- Worksheet questions reuse the api-server assessment generator; PDF is built client-side (jspdf), mirroring the existing report-export pattern.

# Speed math arena
- Reuses the existing race-safe `/games/score` award path (`game: "speed"`), capped by `MAX_GAME_XP`. No new reward/award code path was added — do not invent one.
- The component allows immediate "Play Again", so the score-submit mutation can resolve out of order. A `roundRef` token is captured in `finish()` and re-checked in `onSuccess`; stale-round responses are dropped so XP from a prior round can't overwrite the current UI / trigger a wrong parent XP refresh.
- **How to apply:** any timed mini-game with restart-before-settle must guard async award results with a round/request token.

# Flashcards & concepts
- Flashcards and the Concept Library share one client data source (`src/lib/concepts.ts`). ConceptLibrary takes an optional `vidyaId` prop to enable the bookmark toggle; without it the library is read-only (e.g. tutor preview).
- Purely numeric display like "3 / 8" must NOT be an i18n key — the verbatim-English guard (ta/hi/te) flags `{current} / {total}` since the placeholder words are alphabetic and >12 chars. Render numbers inline instead.

# Tutor⇄parent messaging
- A thread is keyed by (tutorVidyaId, parentVidyaId) and is only allowed when the two share a student in `parent_student_links`. Receiving a message creates a notification.
