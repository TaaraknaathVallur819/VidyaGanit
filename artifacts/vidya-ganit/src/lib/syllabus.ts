// Board-aware tailoring for the Brain Games.
//
// Honest reality (see api-server/src/lib/curriculum.ts): across Indian boards the
// Classes 4–7 maths *topics* are broadly common — what differs is depth,
// sequencing/emphasis and the real-life contexts each board leans on. So board
// tailoring here is two things:
//   1. ordering — each board surfaces the games in the order that matches the
//      emphasis its textbooks are known for (the core set stays the class set);
//   2. timing — more rigorous boards (ICSE, international) give a little more
//      thinking time per round.
// Both are layered on top of the class filter, so a student always sees games
// that fit their class, ordered & timed for their board.

import { INDIA_BOARDS } from "@workspace/india-boards";
import {
  clampClass,
  gamesForClass,
  type GameDef,
  type GameId,
} from "./games";

export type BoardProfileId = "cbse" | "icse" | "state" | "international";

const CATEGORY_BY_VALUE = new Map(
  INDIA_BOARDS.map((b) => [b.value, b.category] as const),
);

/**
 * Normalise a stored board value into one of four tailoring profiles. ICSE is
 * called out for its extra rigour/breadth; the international boards (IB/IGCSE)
 * use enquiry-led framing; the remaining national boards map to the CBSE/NCERT
 * baseline; every state / UT / open / madrasa / Sanskrit board follows the
 * NCERT-aligned core, so they share the "state" profile.
 */
export function boardProfileId(board: string | null | undefined): BoardProfileId {
  const value = (board ?? "").trim();
  if (!value) return "cbse";
  if (value === "ICSE") return "icse";
  const category = CATEGORY_BY_VALUE.get(value);
  if (category === "international") return "international";
  if (category === "national") return "cbse";
  if (category === undefined) {
    // Unknown / free-text board: fall back to the NCERT-aligned state profile,
    // unless it clearly names an international curriculum.
    return /\b(ib|igcse|cambridge|international)\b/i.test(value)
      ? "international"
      : "state";
  }
  return "state";
}

/** A short, human label for the board to show on the games header. */
export function boardShortLabel(board: string | null | undefined): string {
  const value = (board ?? "").trim();
  if (!value) return "CBSE";
  // Trim the "– long description" tail that some board labels carry, and drop a
  // trailing "(ABBR)" so the chip stays compact.
  return value.replace(/\s*[–-].*$/, "").replace(/\s*\([^)]*\)\s*$/, "").trim() || value;
}

// Per-profile thinking-time multiplier. ICSE and international boards expect a
// little more depth, so their rounds run slightly longer.
const TIME_FACTOR: Record<BoardProfileId, number> = {
  cbse: 1,
  state: 1,
  icse: 1.15,
  international: 1.1,
};

// Per-profile emphasis: the order each board's textbooks tend to foreground.
// Games not listed keep their natural catalog order, appended after the
// emphasised ones (a stable sort preserves that).
const EMPHASIS: Record<BoardProfileId, GameId[]> = {
  // NCERT baseline — keep the catalog's progression as-is.
  cbse: [],
  // ICSE leans conceptual & broad: fractions/decimals/ratio/geometry up front.
  icse: ["fractions", "decimals", "ratio", "percent", "geometry", "mensuration", "algebra"],
  // State boards foreground fundamentals and real-life money/number sense.
  state: ["speed", "money", "multiples", "place", "rounding", "factors", "fractions"],
  // International boards lead with data-handling & proportional reasoning.
  international: ["average", "ratio", "percent", "geometry", "mensuration", "fractions"],
};

/**
 * How long (seconds) a round of `def` should run for a given class & board.
 * Base time grows with topic complexity (simple drills are quick, multi-step
 * concepts get more thinking time); a small per-class nudge and the board's
 * time factor are layered on, then clamped to a sane 15–70s window.
 */
export function timerFor(
  def: GameDef,
  cls: number | null | undefined,
  board: string | null | undefined,
): number {
  const base = 14 + def.complexity * 7; // c1 → 21s … c5 → 49s
  const classNudge = (clampClass(cls) - 4) * 1.5; // older classes get a touch more
  const factor = TIME_FACTOR[boardProfileId(board)];
  const seconds = Math.round((base + classNudge) * factor);
  return Math.min(70, Math.max(15, seconds));
}

/**
 * The games for a student's class, ordered for their board. The set is the class
 * set (boards share the Classes 4–7 maths core); the board only changes which
 * topics come first, matching how that board's syllabus is sequenced.
 */
export function gamesForClassBoard(
  cls: number | null | undefined,
  board: string | null | undefined,
): GameDef[] {
  const list = gamesForClass(cls);
  const emphasis = EMPHASIS[boardProfileId(board)];
  if (emphasis.length === 0) return list;
  const rank = new Map(emphasis.map((id, i) => [id, i] as const));
  return [...list].sort((a, b) => {
    const ra = rank.get(a.id) ?? Number.MAX_SAFE_INTEGER;
    const rb = rank.get(b.id) ?? Number.MAX_SAFE_INTEGER;
    return ra - rb;
  });
}

/**
 * Map a tutor-detected topic (the `Topic` strings the API server sends with a
 * game offer) to an ordered list of game candidates, best match first. Used to
 * auto-launch a game tailored to what the student just asked about.
 */
const TOPIC_GAME_CANDIDATES: Record<string, GameId[]> = {
  fraction: ["fractions"],
  multiply: ["multiples", "speed"],
  divide: ["factors", "hcflcm", "speed"],
  add_subtract: ["speed", "integers", "missing"],
  percent: ["percent", "interest"],
  geometry: ["geometry", "mensuration"],
  algebra: ["algebra"],
  decimal: ["decimals"],
  ratio: ["ratio", "percent"],
};

/**
 * Pick the game that best matches a topic AND is available for the student's
 * class/board. Returns null when the topic has no mapping or none of its
 * candidate games are available (e.g. an age-inappropriate topic) — the caller
 * should then fall back to the game menu.
 */
export function gameForTopic(
  topic: string | null | undefined,
  cls: number | null | undefined,
  board: string | null | undefined,
): GameId | null {
  const candidates = TOPIC_GAME_CANDIDATES[(topic ?? "").trim()];
  if (!candidates || candidates.length === 0) return null;
  const available = new Set(gamesForClassBoard(cls, board).map((g) => g.id));
  for (const id of candidates) {
    if (available.has(id)) return id;
  }
  return null;
}

/**
 * Like {@link gameForTopic} but NEVER returns null when the student has any
 * available games: when the topic has no class/board-appropriate match (or no
 * mapping at all), it falls back to the first game available for the student's
 * class & board. Used by the "play a game?" offer so that tapping "Yes" ALWAYS
 * launches a game immediately instead of dropping the student on the menu.
 */
export function gameForTopicOrDefault(
  topic: string | null | undefined,
  cls: number | null | undefined,
  board: string | null | undefined,
): GameId | null {
  return gameForTopic(topic, cls, board) ?? gamesForClassBoard(cls, board)[0]?.id ?? null;
}
