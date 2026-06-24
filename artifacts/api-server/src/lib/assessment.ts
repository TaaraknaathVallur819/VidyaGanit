import type { Topic } from "./tutor";
import type { AssessmentQuestion, MockQuestion } from "@workspace/db";

/**
 * Deterministic, self-checking test generator. For a GRADED test the answer key
 * must be guaranteed correct, so questions are generated programmatically (like
 * the mini-games) rather than via the language model, which could produce a
 * wrong key. Each test is a small multiple-choice worksheet scaled to the
 * student's class. Scoring is simple: `correctCount * POINTS_PER_CORRECT`, with
 * NO negative marking.
 */

export const POINTS_PER_CORRECT = 10;
export const QUESTIONS_PER_TEST = 5;

export const TOPIC_LABELS: Record<Topic, string> = {
  greeting: "Maths Warm-up",
  giveup: "Maths Warm-up",
  fraction: "Fractions",
  multiply: "Multiplication",
  divide: "Division",
  add_subtract: "Addition & Subtraction",
  percent: "Percentages",
  geometry: "Geometry",
  algebra: "Algebra",
  decimal: "Decimals",
  ratio: "Ratios",
  general: "Mixed Maths",
};

export function topicLabel(topic: string): string {
  return (TOPIC_LABELS as Record<string, string>)[topic] ?? "Mixed Maths";
}

export interface MistakeItem {
  testId: string;
  topic: string;
  topicLabel: string;
  completedAt: string;
  prompt: string;
  options: string[];
  correctIndex: number;
  chosenIndex: number;
}

export interface CompletedAssessmentRow {
  testId: string;
  topic: string;
  topicLabel: string;
  completedAt: string;
  questions: AssessmentQuestion[];
  submittedAnswers: number[] | null;
}

/**
 * Flatten completed assessments into the individual questions the student got
 * wrong (chosen option !== correct option). Rows are expected newest-first; the
 * output preserves that order so the notebook shows the most recent mistakes
 * first. Tests with no captured answers (legacy/pending) are skipped.
 */
export function collectMistakes(
  rows: CompletedAssessmentRow[],
  limit = 50,
): MistakeItem[] {
  const out: MistakeItem[] = [];
  for (const row of rows) {
    const chosen = row.submittedAnswers;
    if (!chosen) continue;
    row.questions.forEach((q, i) => {
      const chosenIndex = Number.isInteger(chosen[i]) ? chosen[i] : -1;
      if (chosenIndex === q.answerIndex) return;
      if (out.length >= limit) return;
      out.push({
        testId: row.testId,
        topic: row.topic,
        topicLabel: row.topicLabel,
        completedAt: row.completedAt,
        prompt: q.prompt,
        options: q.options,
        correctIndex: q.answerIndex,
        chosenIndex,
      });
    });
    if (out.length >= limit) break;
  }
  return out;
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Build a 4-option MCQ from a correct numeric answer plus near distractors. */
function numberQuestion(prompt: string, correct: number, spread: number): AssessmentQuestion {
  const set = new Set<number>([correct]);
  let guard = 0;
  while (set.size < 4 && guard < 80) {
    guard++;
    const delta = randInt(1, spread) * (Math.random() < 0.5 ? -1 : 1);
    const cand = correct + delta;
    if (cand >= 0) set.add(cand);
  }
  let n = correct + 1;
  while (set.size < 4) {
    if (n >= 0) set.add(n);
    n++;
  }
  const options = shuffle([...set]).map((v) => String(v));
  return { prompt, options, answerIndex: options.indexOf(String(correct)) };
}

/** Build a 4-option MCQ from a correct string answer plus given distractors. */
function stringQuestion(prompt: string, correct: string, distractors: string[]): AssessmentQuestion {
  const picks: string[] = [];
  for (const d of distractors) {
    if (d !== correct && !picks.includes(d)) picks.push(d);
    if (picks.length === 3) break;
  }
  let pad = 2;
  while (picks.length < 3) {
    const filler = `${correct}${"\u200b".repeat(pad)}`;
    if (!picks.includes(filler)) picks.push(filler);
    pad++;
  }
  const options = shuffle([correct, ...picks]);
  return { prompt, options, answerIndex: options.indexOf(correct) };
}

function classLevel(klass: string | null): number {
  const n = parseInt(klass ?? "5", 10);
  return Number.isFinite(n) ? n : 5;
}

function fractionDistractors(num: number, den: number): string[] {
  const tries: Array<[number, number]> = [
    [num + 1, den],
    [num, den + 1],
    [Math.max(1, num - 1), den],
    [num + 1, den + 1],
    [num, Math.max(2, den - 1)],
  ];
  const out: string[] = [];
  for (const [n, d] of tries) {
    if (n > 0 && d > 1 && !(n === num && d === den)) out.push(`${n}/${d}`);
  }
  return out;
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

type Gen = (klass: number) => AssessmentQuestion;

function addSubGen(klass: number): AssessmentQuestion {
  const hi = klass >= 6 ? 200 : 50;
  const a = randInt(10, hi);
  const b = randInt(1, hi);
  if (Math.random() < 0.5) {
    return numberQuestion(`What is ${a} + ${b}?`, a + b, 8);
  }
  const big = Math.max(a, b);
  const small = Math.min(a, b);
  return numberQuestion(`What is ${big} \u2212 ${small}?`, big - small, 8);
}

function multiplyGen(klass: number): AssessmentQuestion {
  const hi = klass >= 6 ? 15 : 10;
  const a = randInt(2, hi);
  const b = randInt(2, hi);
  return numberQuestion(`What is ${a} \u00d7 ${b}?`, a * b, 10);
}

function divideGen(klass: number): AssessmentQuestion {
  const q = randInt(2, klass >= 6 ? 12 : 9);
  const b = randInt(2, klass >= 6 ? 12 : 9);
  return numberQuestion(`What is ${q * b} \u00f7 ${b}?`, q, 5);
}

function decimalGen(_klass: number): AssessmentQuestion {
  const a = randInt(5, 90) / 10;
  const b = randInt(5, 90) / 10;
  const sum = Math.round((a + b) * 10) / 10;
  const options = new Set<string>([sum.toFixed(1)]);
  let guard = 0;
  while (options.size < 4 && guard < 60) {
    guard++;
    const d = (randInt(1, 9) / 10) * (Math.random() < 0.5 ? -1 : 1);
    const cand = Math.round((sum + d) * 10) / 10;
    if (cand >= 0) options.add(cand.toFixed(1));
  }
  const arr = shuffle([...options]);
  return {
    prompt: `What is ${a.toFixed(1)} + ${b.toFixed(1)}?`,
    options: arr,
    answerIndex: arr.indexOf(sum.toFixed(1)),
  };
}

function percentGen(klass: number): AssessmentQuestion {
  const p = [5, 10, 20, 25, 50][randInt(0, 4)];
  const base = randInt(2, klass >= 6 ? 20 : 10) * 20;
  const correct = (base * p) / 100;
  return numberQuestion(`What is ${p}% of ${base}?`, correct, 6);
}

function fractionGen(klass: number): AssessmentQuestion {
  const den = randInt(2, 6);
  const num = randInt(1, den - 1);
  const k = randInt(2, klass >= 6 ? 5 : 3);
  const correct = `${num}/${den}`;
  return stringQuestion(
    `Simplify the fraction ${num * k}/${den * k} to its lowest terms.`,
    correct,
    fractionDistractors(num, den),
  );
}

function ratioGen(klass: number): AssessmentQuestion {
  let x = randInt(1, 6);
  let y = randInt(1, 6);
  const g = gcd(x, y);
  x = x / g;
  y = y / g;
  const k = randInt(2, klass >= 6 ? 6 : 4);
  const correct = `${x}:${y}`;
  const distractors = [`${x * k}:${y}`, `${x}:${y * k}`, `${y}:${x}`, `${x + 1}:${y + 1}`];
  return stringQuestion(`Simplify the ratio ${x * k} : ${y * k}.`, correct, distractors);
}

function algebraGen(klass: number): AssessmentQuestion {
  const x = randInt(2, klass >= 6 ? 20 : 10);
  if (Math.random() < 0.5) {
    const a = randInt(1, klass >= 6 ? 20 : 10);
    return numberQuestion(`If x + ${a} = ${x + a}, what is x?`, x, 5);
  }
  const a = randInt(2, klass >= 6 ? 9 : 6);
  return numberQuestion(`If ${a} \u00d7 x = ${a * x}, what is x?`, x, 5);
}

function geometryGen(klass: number): AssessmentQuestion {
  const l = randInt(3, klass >= 6 ? 15 : 9);
  const w = randInt(2, klass >= 6 ? 12 : 8);
  if (Math.random() < 0.5) {
    return numberQuestion(
      `A rectangle is ${l} cm long and ${w} cm wide. What is its area in square cm?`,
      l * w,
      10,
    );
  }
  return numberQuestion(
    `A rectangle is ${l} cm long and ${w} cm wide. What is its perimeter in cm?`,
    2 * (l + w),
    6,
  );
}

const GENERATORS: Record<Topic, Gen> = {
  greeting: addSubGen,
  giveup: addSubGen,
  general: addSubGen,
  add_subtract: addSubGen,
  multiply: multiplyGen,
  divide: divideGen,
  decimal: decimalGen,
  percent: percentGen,
  fraction: fractionGen,
  ratio: ratioGen,
  algebra: algebraGen,
  geometry: geometryGen,
};

const MIXED_POOL: Gen[] = [addSubGen, multiplyGen, divideGen, decimalGen];

/** Topics a full-length mock exam draws from, scaled down for younger classes. */
export const MOCK_TOPICS: Topic[] = [
  "add_subtract",
  "multiply",
  "divide",
  "fraction",
  "decimal",
  "percent",
  "ratio",
  "algebra",
  "geometry",
];

const MOCK_TOPICS_JUNIOR: Topic[] = [
  "add_subtract",
  "multiply",
  "divide",
  "fraction",
  "decimal",
  "percent",
  "geometry",
];

/**
 * Generate a full-length, multi-topic mock exam scaled to the student's class.
 * Questions round-robin across the topic pool (gentler for Classes 4–5) and each
 * carries its source `topic` so results can be broken down per topic. Returns
 * `count` distinct (by prompt) questions.
 */
export function generateMockExam(klass: string | null, count: number): MockQuestion[] {
  const level = classLevel(klass);
  const pool = level >= 6 ? MOCK_TOPICS : MOCK_TOPICS_JUNIOR;
  const out: MockQuestion[] = [];
  const seen = new Set<string>();
  let guard = 0;
  let i = 0;
  while (out.length < count && guard < count * 40) {
    guard++;
    const topic = pool[i % pool.length];
    i++;
    const gen = (GENERATORS as Record<string, Gen>)[topic] ?? addSubGen;
    const q = gen(level);
    if (seen.has(q.prompt)) continue;
    seen.add(q.prompt);
    out.push({ ...q, topic });
  }
  return out;
}

/**
 * Generate a fresh worksheet for the topic, scaled to the student's class.
 * Always returns `QUESTIONS_PER_TEST` distinct (by prompt) questions.
 */
export function generateAssessment(topic: string, klass: string | null): AssessmentQuestion[] {
  const level = classLevel(klass);
  const baseGen = (GENERATORS as Record<string, Gen>)[topic] ?? addSubGen;
  const isMixed = topic === "general" || topic === "greeting" || topic === "giveup";

  const questions: AssessmentQuestion[] = [];
  const seen = new Set<string>();
  let guard = 0;
  while (questions.length < QUESTIONS_PER_TEST && guard < 200) {
    guard++;
    const gen = isMixed ? MIXED_POOL[questions.length % MIXED_POOL.length] : baseGen;
    const q = gen(level);
    if (seen.has(q.prompt)) continue;
    seen.add(q.prompt);
    questions.push(q);
  }
  return questions;
}
