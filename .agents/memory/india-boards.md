---
name: Indian education boards (shared catalog)
description: Single source of truth for the Indian board list shared by the registration picker and the AI tutor prompts.
---

# Indian education boards

The canonical list of Indian school boards lives in ONE shared lib,
`@workspace/india-boards` (`lib/india-boards`), consumed by BOTH the web app
(registration board picker) and the API server (AI tutor prompt building). Do
not re-hardcode board lists in either artifact — extend the lib instead.

It covers the full landscape, not just major boards: national (CBSE, ICSE/CISCE,
NIOS), all 28 state boards, all 8 UT boards, open-schooling, madrasa, sanskrit,
and international (IB/IGCSE), plus an `Other` fallback.

**Why:** the user explicitly required AI knowledge of the Classes 4–7 maths
syllabus for *every* Indian board across all three portals; a single catalog
keeps the picker and the AI prompt in lockstep.

**How to apply:**
- The Classes 4–7 maths *core* is NCERT-aligned and common across all boards;
  the AI prompt frames every board as a variation on that core (depth,
  sequencing, vocabulary, local context). The catalog feeds the prompt via
  `summarizeBoardsForPrompt()` injected into `buildSyllabusKnowledge()` (which
  flows into all three system prompts: student tutor, parent counsellor, tutor
  coach).
- The picker renders `boardsByCategory()` (grouped, excludes `Other`).
- **Stored `value` strings are backward-compatible** — existing users' saved
  board values (e.g. `CBSE`, `Maharashtra State Board`, `UP Board (UPMSP)`)
  MUST keep matching a catalog entry, or their selection won't show. A vitest
  guard in the api-server suite asserts the 28 states, 8 UTs, category coverage,
  and the legacy values.
