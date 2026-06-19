---
name: Mistake Notebook
description: How missed test questions are captured and surfaced for student review
---

# Mistake Notebook

The student-facing review of questions they got wrong on graded tests.

**Data capture:** assessments only stored score/correctCount historically — not the student's chosen answers. The submit handler now persists `submittedAnswers` (per-question chosen option index, `-1` for blank). This column is **nullable** on purpose: tests submitted before it existed stay null and are skipped, never shown as "all wrong".

**Derivation, not storage:** mistakes are computed on read by diffing `submittedAnswers[i]` against the question's `answerIndex` (pure `collectMistakes` helper), newest-first, capped (default 50). Nothing about "which questions were missed" is stored separately — it always derives from the assessment rows, so it stays correct if scoring logic changes.

**Why derive instead of store a mistakes table:** the answer key already lives server-side in the assessment row; a separate table would duplicate it and risk drift. Keep the answer key server-side — the generate endpoint never returns `answerIndex`; mistakes are only exposed for the student's OWN completed tests (requireAuth + requireSelf + status="completed" filter).

**How to apply:** any new "review" surface (e.g. re-practice missed questions) should call `collectMistakes`/the mistakes endpoint, not invent its own diff. New per-question captured data belongs as another nullable column on assessments, populated in the submit handler.
