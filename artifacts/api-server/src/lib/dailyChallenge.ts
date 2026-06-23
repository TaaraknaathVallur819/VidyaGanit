// Deterministic "Problem of the Day" generator. Seeded purely by (date, class)
// so every student in a class sees the same problem and repeated GETs are
// idempotent — there is no stored challenge, only the seed. The correct answer
// never leaves the server until the student has submitted.

export interface DailyChallenge {
  date: string;
  question: string;
  options: number[];
  answer: number;
}

function hashSeed(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function classLevel(klass: string | null): number {
  const n = parseInt(klass ?? "5", 10);
  return Number.isFinite(n) ? n : 5;
}

/** Build a 4-option set of distinct integers around the correct answer. */
function options(rand: () => number, correct: number): number[] {
  const set = new Set<number>([correct]);
  let guard = 0;
  while (set.size < 4 && guard < 60) {
    guard++;
    const delta = (1 + Math.floor(rand() * 6)) * (rand() < 0.5 ? -1 : 1);
    const cand = correct + delta;
    if (cand >= 0) set.add(cand);
  }
  let n = correct + 1;
  while (set.size < 4) set.add(n++);
  // Shuffle deterministically.
  const arr = [...set];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function generateDailyChallenge(
  dateStr: string,
  klass: string | null,
): DailyChallenge {
  const level = classLevel(klass);
  const rand = mulberry32(hashSeed(`${dateStr}:${level}`));
  const kind = Math.floor(rand() * 4);
  const hi = level >= 6 ? 30 : 15;

  let question: string;
  let answer: number;
  if (kind === 0) {
    const a = 2 + Math.floor(rand() * hi);
    const b = 2 + Math.floor(rand() * hi);
    question = `What is ${a} + ${b}?`;
    answer = a + b;
  } else if (kind === 1) {
    const a = 5 + Math.floor(rand() * hi);
    const b = 1 + Math.floor(rand() * a);
    question = `What is ${a} \u2212 ${b}?`;
    answer = a - b;
  } else if (kind === 2) {
    const a = 2 + Math.floor(rand() * (level >= 6 ? 12 : 9));
    const b = 2 + Math.floor(rand() * (level >= 6 ? 12 : 9));
    question = `What is ${a} \u00d7 ${b}?`;
    answer = a * b;
  } else {
    const q = 2 + Math.floor(rand() * (level >= 6 ? 12 : 9));
    const b = 2 + Math.floor(rand() * (level >= 6 ? 12 : 9));
    question = `What is ${q * b} \u00f7 ${b}?`;
    answer = q;
  }

  return { date: dateStr, question, options: options(rand, answer), answer };
}
