---
name: Brain Games board/class tailoring
description: How VidyaGanit's Brain Games are tailored to a student's Class + Indian board, and the honesty constraint behind it.
---

# Brain Games tailoring

Game catalog lives in `artifacts/vidya-ganit/src/lib/games.ts`; class/board tailoring + timers in `src/lib/syllabus.ts`.

## The honesty constraint (why tailoring is sequencing + pacing, not different topic pools)
Across Indian boards (CBSE/ICSE/state/international) the Classes 4–7 maths *topics* are broadly common — what genuinely differs is depth, sequencing/emphasis, and rigour. So board tailoring must NOT fabricate different topic sets per board.

**Rule:** the game *set* is the class set (same games for a given class regardless of board). The board only changes (1) ordering — `gamesForClassBoard` does a stable reorder by a per-profile EMPHASIS list — and (2) timing — `timerFor` applies a board TIME_FACTOR (icse 1.15, international 1.1, else 1.0).

**Why:** claiming board-specific curricula we don't actually have would be dishonest to parents/tutors. Keep differentiation to emphasis + pacing.

**How to apply:** if asked to "make boards more different," resist adding fake board-only games. Adjust EMPHASIS ordering or TIME_FACTOR, or add genuinely class-appropriate games shared across boards.

## Timers
`timerFor(def, cls, board)` = clamp(15..70, round((14 + complexity*7 + (clampClass-4)*1.5) * boardFactor)). Complexity 1..5 on each `GameDef` drives the base; complex topics get longer rounds. There is no fixed ROUND_SECONDS anymore.

## Generators
Prompts are kept symbolic/numeric (no English words) so one generator serves all 23 languages; only name/desc are translated via i18n keys. truefalse games use options `["true","false"]` with index 0 = true. `makePrimes` returns answer 0 when the number is prime.
