// Brain-games question bank. Each game is class-aware (Classes 4–7): the
// generators scale difficulty by the student's class, and the catalog declares
// which classes a game suits (minClass..maxClass) so the menu only shows topics
// appropriate to the chosen class.
//
// Prompts are kept deliberately symbolic/numeric (no English words) so a single
// generator works across all 23 languages + English. Only the game name/desc
// are translated, via i18n keys.

export type GameId =
  | "speed"
  | "truefalse"
  | "missing"
  | "place"
  | "rounding"
  | "factors"
  | "multiples"
  | "primes"
  | "money"
  | "fractions"
  | "decimals"
  | "percent"
  | "average"
  | "hcflcm"
  | "ratio"
  | "geometry"
  | "mensuration"
  | "integers"
  | "algebra"
  | "interest"
  | "exponents";

export type GameKind = "mcq" | "truefalse";

// Topic complexity, 1 (simple drill) … 5 (multi-step concept). Drives how long a
// round's timer runs: harder topics get more thinking time (see syllabus.ts).
export type Complexity = 1 | 2 | 3 | 4 | 5;

export type GameQuestion = {
  prompt: string;
  options: string[];
  answer: number; // index into options
};

export type GameDef = {
  id: GameId;
  emoji: string;
  nameKey: string;
  descKey: string;
  kind: GameKind;
  minClass: number;
  maxClass: number;
  complexity: Complexity;
  make: (cls: number) => GameQuestion;
};

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function clampClass(cls: number | null | undefined): number {
  if (cls == null || Number.isNaN(cls)) return 5;
  if (cls < 4) return 4;
  if (cls > 7) return 7;
  return Math.floor(cls);
}

// Build a numeric MCQ with three random distractors near the answer.
function numericQuestion(
  prompt: string,
  answer: number,
  spread = 9,
  allowNeg = false,
): GameQuestion {
  const set = new Set<number>([answer]);
  let guard = 0;
  while (set.size < 4 && guard < 80) {
    guard++;
    const delta = randInt(-spread, spread);
    const cand = answer + delta;
    if (delta !== 0 && (allowNeg || cand >= 0)) set.add(cand);
  }
  let n = answer + 1;
  while (set.size < 4) {
    if (n !== answer && (allowNeg || n >= 0)) set.add(n);
    n++;
  }
  const opts = shuffle([...set]).map(String);
  return { prompt, options: opts, answer: opts.indexOf(String(answer)) };
}

// Build a numeric MCQ from a curated distractor pool (falls back to nearby
// numbers if the pool is too small).
function mcFrom(
  prompt: string,
  answer: number,
  distractors: number[],
  allowNeg = false,
): GameQuestion {
  const pool = [...new Set(distractors)].filter(
    (d) => d !== answer && (allowNeg || d >= 0),
  );
  const picks = shuffle(pool).slice(0, 3);
  let i = answer + 1;
  while (picks.length < 3) {
    if (i !== answer && (allowNeg || i >= 0) && !picks.includes(i)) picks.push(i);
    i++;
  }
  const opts = shuffle([answer, ...picks]).map(String);
  return { prompt, options: opts, answer: opts.indexOf(String(answer)) };
}

// Build a string-answer MCQ (e.g. fractions / decimals).
function mcFromStr(
  prompt: string,
  answer: string,
  distractors: string[],
): GameQuestion {
  const pool = [...new Set(distractors)].filter((d) => d !== answer);
  const picks = shuffle(pool).slice(0, 3);
  let i = 1;
  while (picks.length < 3) {
    const cand = `${i}/9`;
    if (cand !== answer && !picks.includes(cand)) picks.push(cand);
    i++;
  }
  const opts = shuffle([answer, ...picks]);
  return { prompt, options: opts, answer: opts.indexOf(answer) };
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

// ── Generators ──────────────────────────────────────────────────────────────

function makeSpeed(c: number): GameQuestion {
  const ops = c >= 5 ? (["+", "−", "×", "÷"] as const) : (["+", "−", "×"] as const);
  const op = ops[randInt(0, ops.length - 1)];
  const addMax = c <= 4 ? 49 : c === 5 ? 99 : c === 6 ? 199 : 499;
  const mulMax = c <= 4 ? 10 : c === 5 ? 12 : c === 6 ? 15 : 20;
  let a: number;
  let b: number;
  let answer: number;
  if (op === "+") {
    a = randInt(2, addMax);
    b = randInt(2, addMax);
    answer = a + b;
  } else if (op === "−") {
    a = randInt(10, addMax);
    b = randInt(1, a);
    answer = a - b;
  } else if (op === "×") {
    a = randInt(2, mulMax);
    b = randInt(2, mulMax);
    answer = a * b;
  } else {
    b = randInt(2, mulMax);
    answer = randInt(2, mulMax);
    a = b * answer; // exact division
  }
  return numericQuestion(`${a} ${op} ${b} = ?`, answer, Math.max(5, Math.floor(answer * 0.2)));
}

function makeMissing(c: number): GameQuestion {
  const ops = c >= 5 ? (["+", "−", "×", "÷"] as const) : (["+", "−", "×"] as const);
  const op = ops[randInt(0, ops.length - 1)];
  const addMax = c <= 4 ? 30 : c === 5 ? 50 : 80;
  const mulMax = c <= 4 ? 10 : 12;
  let a: number;
  let result: number;
  let missing: number;
  if (op === "+") {
    a = randInt(2, addMax);
    missing = randInt(2, addMax);
    result = a + missing;
  } else if (op === "−") {
    missing = randInt(2, addMax);
    a = randInt(missing, addMax * 2);
    result = a - missing;
  } else if (op === "×") {
    a = randInt(2, mulMax);
    missing = randInt(2, mulMax);
    result = a * missing;
  } else {
    missing = randInt(2, mulMax);
    a = randInt(2, mulMax) * missing;
    result = a / missing;
  }
  return numericQuestion(`${a} ${op} ? = ${result}`, missing, Math.max(4, Math.floor(missing * 0.4)));
}

function makeTrueFalse(c: number): GameQuestion {
  const ops = c >= 5 ? (["+", "−", "×", "÷"] as const) : (["+", "−", "×"] as const);
  const op = ops[randInt(0, ops.length - 1)];
  const addMax = c <= 4 ? 49 : c === 5 ? 99 : 199;
  const mulMax = c <= 4 ? 10 : 12;
  let a: number;
  let b: number;
  let real: number;
  if (op === "+") {
    a = randInt(2, addMax);
    b = randInt(2, addMax);
    real = a + b;
  } else if (op === "−") {
    a = randInt(10, addMax);
    b = randInt(1, a);
    real = a - b;
  } else if (op === "×") {
    a = randInt(2, mulMax);
    b = randInt(2, mulMax);
    real = a * b;
  } else {
    b = randInt(2, mulMax);
    real = randInt(2, mulMax);
    a = b * real;
  }
  const isTrue = Math.random() < 0.5;
  let shown = real;
  if (!isTrue) {
    do {
      const delta = (Math.random() < 0.5 ? 1 : -1) * randInt(1, 5);
      shown = Math.max(0, real + delta);
    } while (shown === real);
  }
  return {
    prompt: `${a} ${op} ${b} = ${shown}`,
    options: ["true", "false"],
    answer: isTrue ? 0 : 1,
  };
}

function makePlace(c: number): GameQuestion {
  const len = c <= 4 ? 3 : 4;
  const n = randInt(10 ** (len - 1), 10 ** len - 1);
  const ds = String(n).split("");
  const idx = randInt(0, ds.length - 1);
  const placeFromRight = ds.length - 1 - idx;
  const digit = Number(ds[idx]);
  const value = digit * 10 ** placeFromRight;
  // Mark the target digit with brackets so the question needs no words.
  const shown = ds.map((d, i) => (i === idx ? `[${d}]` : d)).join("");
  return mcFrom(`${shown} = ?`, value, [digit, digit * 10, digit * 100, digit * 1000]);
}

function makeRounding(c: number): GameQuestion {
  const base = c <= 4 ? 10 : Math.random() < 0.5 ? 10 : 100;
  const maxN = c <= 4 ? 99 : c === 5 ? 999 : 9999;
  const n = randInt(base + 5, maxN);
  const rounded = Math.round(n / base) * base;
  return mcFrom(`${n} → ${base} = ?`, rounded, [
    Math.floor(n / base) * base,
    Math.ceil(n / base) * base,
    rounded + base,
    Math.max(0, rounded - base),
  ]);
}

function makeFactors(c: number): GameQuestion {
  const n = randInt(c <= 4 ? 12 : 24, c <= 4 ? 40 : 99);
  const factors: number[] = [];
  for (let i = 2; i < n; i++) if (n % i === 0) factors.push(i);
  const answer = factors.length ? factors[randInt(0, factors.length - 1)] : 1;
  const distractors: number[] = [];
  let g = 2;
  while (distractors.length < 8 && g < n) {
    if (n % g !== 0) distractors.push(g);
    g++;
  }
  return mcFrom(`${n} ÷ ? = ✓`, answer, distractors);
}

function makeFractions(c: number): GameQuestion {
  // Class 5+ sometimes asks for a fraction of a whole number (a/b × n).
  if (c >= 5 && Math.random() < 0.5) {
    const den = randInt(2, c <= 5 ? 5 : 8);
    const k = randInt(2, 6);
    const whole = den * k;
    const numer = randInt(1, den - 1);
    const answer = numer * k;
    return numericQuestion(`${numer}/${den} × ${whole} = ?`, answer, Math.max(3, k));
  }
  // Otherwise add two fractions with the same denominator.
  const den = randInt(c <= 4 ? 4 : 6, c <= 4 ? 8 : 12);
  const a = randInt(1, den - 1);
  const b = randInt(1, den - 1);
  const num = a + b;
  const answer = `${num}/${den}`;
  return mcFromStr(`${a}/${den} + ${b}/${den} = ?`, answer, [
    `${num}/${den + den}`,
    `${num + 1}/${den}`,
    `${Math.max(1, num - 1)}/${den}`,
    `${a}/${den}`,
  ]);
}

function makeDecimals(c: number): GameQuestion {
  const dp = c <= 5 ? 1 : Math.random() < 0.5 ? 1 : 2;
  const f = 10 ** dp;
  const a = randInt(1, 9 * f) / f;
  const b = randInt(1, 9 * f) / f;
  const op = Math.random() < 0.5 ? "+" : "−";
  const hi = Math.max(a, b);
  const lo = Math.min(a, b);
  const sum = op === "+" ? a + b : hi - lo;
  const ansStr = sum.toFixed(dp);
  const left = op === "+" ? a : hi;
  const right = op === "+" ? b : lo;
  return mcFromStr(`${left.toFixed(dp)} ${op} ${right.toFixed(dp)} = ?`, ansStr, [
    (sum + 1 / f).toFixed(dp),
    (Math.max(0, sum - 1 / f)).toFixed(dp),
    (sum + 1).toFixed(dp),
    (Math.max(0, sum - 1)).toFixed(dp),
  ]);
}

function makePercent(c: number): GameQuestion {
  const pcts = c <= 5 ? [10, 20, 25, 50] : [10, 15, 20, 25, 40, 50, 75];
  const pct = pcts[randInt(0, pcts.length - 1)];
  const step = 100 / gcd(pct, 100);
  const n = step * randInt(1, c <= 5 ? 8 : 15);
  const answer = (n * pct) / 100;
  return numericQuestion(`${pct}% × ${n} = ?`, answer, Math.max(3, Math.floor(answer * 0.3)));
}

function makeGeometry(c: number): GameQuestion {
  const max = c <= 5 ? 12 : 20;
  const l = randInt(2, max);
  const w = randInt(2, max);
  if (Math.random() < 0.5) {
    const area = l * w;
    return numericQuestion(`▭ ${l} × ${w} = ?`, area, Math.max(4, Math.floor(area * 0.2)));
  }
  const perimeter = 2 * (l + w);
  return numericQuestion(`▭ ${l}+${w}+${l}+${w} = ?`, perimeter, 6);
}

function makeIntegers(c: number): GameQuestion {
  const range = c <= 6 ? 20 : 40;
  const a = randInt(-range, range);
  const b = randInt(-range, range);
  const op = Math.random() < 0.5 ? "+" : "−";
  const answer = op === "+" ? a + b : a - b;
  const fmt = (x: number) => (x < 0 ? `(${x})` : `${x}`);
  return numericQuestion(`${fmt(a)} ${op} ${fmt(b)} = ?`, answer, 8, true);
}

function makeAlgebra(c: number): GameQuestion {
  const type = randInt(0, 2);
  const xMax = c <= 6 ? 15 : 25;
  let prompt: string;
  let x: number;
  if (type === 0) {
    x = randInt(1, xMax);
    const a = randInt(1, 15);
    prompt = `x + ${a} = ${x + a} → x?`;
  } else if (type === 1) {
    x = randInt(2, c <= 6 ? 9 : 12);
    const a = randInt(2, c <= 6 ? 9 : 12);
    prompt = `${a}x = ${a * x} → x?`;
  } else {
    x = randInt(1, xMax);
    const a = randInt(1, 15);
    prompt = `x − ${a} = ${x - a} → x?`;
  }
  return numericQuestion(prompt, x, 5, true);
}

function makeExponents(c: number): GameQuestion {
  void c;
  if (Math.random() < 0.6) {
    const b = randInt(2, 15);
    return numericQuestion(`${b}² = ?`, b * b, Math.max(5, b));
  }
  const b = randInt(2, 5);
  const e = randInt(2, 3);
  const answer = b ** e;
  return numericQuestion(`${b}^${e} = ?`, answer, Math.max(5, Math.floor(answer * 0.3)));
}

function isPrime(n: number): boolean {
  if (n < 2) return false;
  for (let i = 2; i * i <= n; i++) if (n % i === 0) return false;
  return true;
}

// Skip-counting: complete the run of multiples (n, 2n, 3n, ?). The next term is
// uniquely 4n, so any distinct distractor is a valid wrong answer.
function makeMultiples(c: number): GameQuestion {
  const n = randInt(2, c <= 4 ? 6 : c === 5 ? 9 : 12);
  const answer = n * 4;
  return mcFrom(`${n}, ${n * 2}, ${n * 3}, ?`, answer, [
    answer - 1,
    answer + 1,
    n * 3 + 1,
    answer + n,
    Math.max(1, answer - n),
  ]);
}

// Prime or composite — shown as a bare number with a ✓ / ✗ choice (the desc
// asks "is it prime?"). Balanced ~50/50 between primes and composites.
function makePrimes(c: number): GameQuestion {
  const max = c <= 5 ? 30 : c === 6 ? 50 : 80;
  let n: number;
  if (Math.random() < 0.5) {
    const primes: number[] = [];
    for (let i = 2; i <= max; i++) if (isPrime(i)) primes.push(i);
    n = primes[randInt(0, primes.length - 1)];
  } else {
    do {
      n = randInt(4, max);
    } while (isPrime(n));
  }
  return { prompt: `${n}`, options: ["true", "false"], answer: isPrime(n) ? 0 : 1 };
}

// Money in rupees: either a sum (₹a + ₹b) or change from a round note (₹note − ₹cost).
function makeMoney(c: number): GameQuestion {
  const max = c <= 4 ? 90 : 500;
  if (Math.random() < 0.5) {
    const a = randInt(5, max);
    const b = randInt(5, max);
    return numericQuestion(`₹${a} + ₹${b} = ?`, a + b, Math.max(5, Math.floor((a + b) * 0.2)));
  }
  const notes = c <= 4 ? [50, 100] : [100, 200, 500];
  const paid = notes[randInt(0, notes.length - 1)];
  const cost = randInt(5, paid - 5);
  return numericQuestion(`₹${paid} − ₹${cost} = ?`, paid - cost, Math.max(5, Math.floor((paid - cost) * 0.2)));
}

// Mean of k numbers (x̄). The numbers are built to make the mean a whole number.
function makeAverage(c: number): GameQuestion {
  const k = c <= 6 ? 2 : 3;
  const mean = randInt(c <= 6 ? 6 : 10, c <= 6 ? 30 : 50);
  let nums: number[] = [];
  for (let guard = 0; guard < 50; guard++) {
    const trial: number[] = [];
    let sum = 0;
    for (let i = 0; i < k - 1; i++) {
      const v = randInt(Math.max(1, mean - 5), mean + 5);
      trial.push(v);
      sum += v;
    }
    const last = mean * k - sum;
    if (last >= 1) {
      trial.push(last);
      nums = trial;
      break;
    }
  }
  if (nums.length < k) nums = Array(k).fill(mean);
  return numericQuestion(`${nums.join(", ")} → x̄ ?`, mean, Math.max(3, Math.floor(mean * 0.3)));
}

// HCF or LCM of two numbers (Indian textbooks use the HCF/LCM abbreviations).
function makeHcfLcm(c: number): GameQuestion {
  const max = c <= 6 ? 12 : 20;
  const a = randInt(2, max);
  const b = randInt(2, max);
  const g = gcd(a, b);
  if (Math.random() < 0.5) {
    return mcFrom(`HCF(${a}, ${b}) = ?`, g, [a, b, g + 1, Math.max(1, g - 1), g * 2]);
  }
  const lcm = (a * b) / g;
  return mcFrom(`LCM(${a}, ${b}) = ?`, lcm, [a * b, lcm + a, Math.max(1, lcm - a), a + b]);
}

// Equivalent ratio: a : b = (a·k) : ? — find the matching term.
function makeRatio(c: number): GameQuestion {
  const a = randInt(1, 6);
  const b = randInt(1, 6);
  const k = randInt(2, c <= 6 ? 5 : 8);
  const answer = b * k;
  return numericQuestion(`${a} : ${b} = ${a * k} : ?`, answer, Math.max(3, Math.floor(answer * 0.3)));
}

// Mensuration: area of a triangle (½·b·h) or a circle (πr², π = 22/7, r a
// multiple of 7 so the answer is a whole number).
function makeMensuration(c: number): GameQuestion {
  void c;
  if (Math.random() < 0.5) {
    const b = randInt(2, 12) * 2;
    const h = randInt(2, 14);
    const area = (b * h) / 2;
    return numericQuestion(`△ ½ × ${b} × ${h} = ?`, area, Math.max(4, Math.floor(area * 0.2)));
  }
  const r = [7, 14, 21][randInt(0, 2)];
  const area = (22 * r * r) / 7;
  return numericQuestion(`◯ 22/7 × ${r}² = ?`, area, Math.max(10, Math.floor(area * 0.2)));
}

// Simple interest (P·R·T/100) or profit/loss (SP − CP, which may be a loss).
function makeInterest(c: number): GameQuestion {
  void c;
  if (Math.random() < 0.5) {
    const p = randInt(1, 20) * 100;
    const r = [2, 4, 5, 8, 10][randInt(0, 4)];
    const t = randInt(1, 3);
    const si = (p * r * t) / 100;
    return numericQuestion(`SI ₹${p}, ${r}%, ${t}y = ?`, si, Math.max(5, Math.floor(si * 0.2)));
  }
  const cp = randInt(2, 20) * 10;
  const delta = randInt(1, 10) * 5;
  const profit = Math.random() < 0.5;
  const sp = profit ? cp + delta : cp - Math.min(delta, cp - 5);
  const answer = sp - cp;
  return numericQuestion(
    `CP ₹${cp} → SP ₹${sp} = ?`,
    answer,
    Math.max(4, Math.floor(Math.abs(answer) * 0.4 + 3)),
    true,
  );
}

// ── Catalog ───────────────────────────────────────────────────────────────

export const GAME_CATALOG: GameDef[] = [
  { id: "speed", emoji: "⚡", nameKey: "games.speed.name", descKey: "games.speed.desc", kind: "mcq", minClass: 4, maxClass: 7, complexity: 2, make: makeSpeed },
  { id: "truefalse", emoji: "🤔", nameKey: "games.truefalse.name", descKey: "games.truefalse.desc", kind: "truefalse", minClass: 4, maxClass: 7, complexity: 2, make: makeTrueFalse },
  { id: "missing", emoji: "🔢", nameKey: "games.missing.name", descKey: "games.missing.desc", kind: "mcq", minClass: 4, maxClass: 6, complexity: 2, make: makeMissing },
  { id: "place", emoji: "🏷️", nameKey: "games.place.name", descKey: "games.place.desc", kind: "mcq", minClass: 4, maxClass: 5, complexity: 1, make: makePlace },
  { id: "rounding", emoji: "📍", nameKey: "games.rounding.name", descKey: "games.rounding.desc", kind: "mcq", minClass: 4, maxClass: 6, complexity: 1, make: makeRounding },
  { id: "factors", emoji: "🧩", nameKey: "games.factors.name", descKey: "games.factors.desc", kind: "mcq", minClass: 4, maxClass: 6, complexity: 3, make: makeFactors },
  { id: "multiples", emoji: "🎯", nameKey: "games.multiples.name", descKey: "games.multiples.desc", kind: "mcq", minClass: 4, maxClass: 6, complexity: 2, make: makeMultiples },
  { id: "primes", emoji: "🔱", nameKey: "games.primes.name", descKey: "games.primes.desc", kind: "truefalse", minClass: 5, maxClass: 7, complexity: 2, make: makePrimes },
  { id: "money", emoji: "💰", nameKey: "games.money.name", descKey: "games.money.desc", kind: "mcq", minClass: 4, maxClass: 5, complexity: 2, make: makeMoney },
  { id: "fractions", emoji: "🍕", nameKey: "games.fractions.name", descKey: "games.fractions.desc", kind: "mcq", minClass: 4, maxClass: 7, complexity: 3, make: makeFractions },
  { id: "decimals", emoji: "🔟", nameKey: "games.decimals.name", descKey: "games.decimals.desc", kind: "mcq", minClass: 5, maxClass: 7, complexity: 3, make: makeDecimals },
  { id: "percent", emoji: "💯", nameKey: "games.percent.name", descKey: "games.percent.desc", kind: "mcq", minClass: 5, maxClass: 7, complexity: 3, make: makePercent },
  { id: "average", emoji: "📊", nameKey: "games.average.name", descKey: "games.average.desc", kind: "mcq", minClass: 6, maxClass: 7, complexity: 3, make: makeAverage },
  { id: "hcflcm", emoji: "🔗", nameKey: "games.hcflcm.name", descKey: "games.hcflcm.desc", kind: "mcq", minClass: 6, maxClass: 7, complexity: 4, make: makeHcfLcm },
  { id: "ratio", emoji: "⚖️", nameKey: "games.ratio.name", descKey: "games.ratio.desc", kind: "mcq", minClass: 6, maxClass: 7, complexity: 4, make: makeRatio },
  { id: "geometry", emoji: "📐", nameKey: "games.geometry.name", descKey: "games.geometry.desc", kind: "mcq", minClass: 5, maxClass: 7, complexity: 3, make: makeGeometry },
  { id: "mensuration", emoji: "🔺", nameKey: "games.mensuration.name", descKey: "games.mensuration.desc", kind: "mcq", minClass: 7, maxClass: 7, complexity: 5, make: makeMensuration },
  { id: "integers", emoji: "❄️", nameKey: "games.integers.name", descKey: "games.integers.desc", kind: "mcq", minClass: 6, maxClass: 7, complexity: 4, make: makeIntegers },
  { id: "algebra", emoji: "🔮", nameKey: "games.algebra.name", descKey: "games.algebra.desc", kind: "mcq", minClass: 6, maxClass: 7, complexity: 4, make: makeAlgebra },
  { id: "interest", emoji: "🏦", nameKey: "games.interest.name", descKey: "games.interest.desc", kind: "mcq", minClass: 7, maxClass: 7, complexity: 5, make: makeInterest },
  { id: "exponents", emoji: "🚀", nameKey: "games.exponents.name", descKey: "games.exponents.desc", kind: "mcq", minClass: 7, maxClass: 7, complexity: 4, make: makeExponents },
];

const BY_ID = new Map<GameId, GameDef>(GAME_CATALOG.map((g) => [g.id, g]));

// Games appropriate for a student's class. When the class is unknown we show
// the full catalog so the student always has plenty to play.
export function gamesForClass(cls: number | null | undefined): GameDef[] {
  if (cls == null || Number.isNaN(cls)) return GAME_CATALOG;
  const c = clampClass(cls);
  return GAME_CATALOG.filter((g) => c >= g.minClass && c <= g.maxClass);
}

export function makeQuestion(id: GameId, cls: number | null | undefined): GameQuestion {
  const def = BY_ID.get(id) ?? GAME_CATALOG[0];
  return def.make(clampClass(cls));
}
