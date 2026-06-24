---
name: Worksheet tailoring (VidyaGanit)
description: How the tutor/parent worksheet generator is tailored to a selected student, and the curriculum-mirror drift risk
---

# Worksheet generator tailoring

The printable worksheet PDF (tutor/parent only) is tailored to a **specific linked student**, not generic.

- `WorksheetGenerator.tsx` picks a student via `useGetLinkedStudents(vidyaId)`, derives that student's class + board, sends `klass` to the existing server worksheet endpoint (which already scales question difficulty by class), and constrains the topic dropdown to that class's curriculum.
- The topic catalog `src/lib/worksheetTopics.ts` (`CLASS_TOPICS`, `TOPIC_I18N`, `topicsForClass`) is a **client-side mirror of the api-server NCERT curriculum** (`artifacts/api-server/src/lib/curriculum.ts`).
- **Board = label only.** Curriculum is NCERT-common across boards, so the student's board is printed in the PDF header (and shown in UI) but does NOT select a different per-board question pool. This is the same honesty stance as brain-games tailoring — do not fabricate per-board question banks.

**Why / drift risk:** the topic catalog is duplicated on the client, so it can silently drift from the server curriculum. `worksheetTopics.test.ts` guards class-constraint behaviour and that every topic's `TOPIC_I18N` label exists in all dictionaries. **How to apply:** if you change the server curriculum's class→topic mapping, update `worksheetTopics.ts` in lockstep (or, better, graduate it to a shared lib generated from the server source).

The server worksheet route stays gated `requireAuth + requireParentOrTutor` — the answer key must never reach a student. No server/OpenAPI change was needed for the tailoring (client-only).
