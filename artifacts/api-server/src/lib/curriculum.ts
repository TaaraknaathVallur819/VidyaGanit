import { summarizeBoardsForPrompt } from "@workspace/india-boards";
import type { Topic } from "./tutor";

/**
 * A single curriculum unit. `topic` aligns with `detectTopic` outputs so a
 * student's chat activity / test scores can be cross-referenced against the
 * unit when recommending the next lesson.
 */
export interface CurriculumUnit {
  id: string;
  topic: Topic;
  title: string;
  description: string;
  lessons: string[];
}

export const CURRICULUM_CLASSES = ["4", "5", "6", "7"] as const;
export type CurriculumClass = (typeof CURRICULUM_CLASSES)[number];

/**
 * Class-wise maths curriculum for Classes 4–7, loosely aligned with the NCERT /
 * CBSE primary-maths progression used across Indian schools. Units are listed
 * in the order a student would typically meet them through the year, which is
 * also the order the "recommended next lesson" engine walks.
 */
export const CURRICULUM: Record<CurriculumClass, CurriculumUnit[]> = {
  "4": [
    {
      id: "c4-add_subtract",
      topic: "add_subtract",
      title: "Addition & Subtraction",
      description: "Building speed and accuracy with larger numbers and money.",
      lessons: [
        "Adding 3 & 4-digit numbers",
        "Subtraction with borrowing",
        "Word problems with money (₹)",
        "Estimation & rounding",
      ],
    },
    {
      id: "c4-multiply",
      topic: "multiply",
      title: "Multiplication",
      description: "From times tables to multiplying bigger numbers.",
      lessons: [
        "Times tables up to 15",
        "Multiplying 2 & 3-digit numbers",
        "Multiplication word problems",
      ],
    },
    {
      id: "c4-divide",
      topic: "divide",
      title: "Division",
      description: "Sharing equally and the basics of long division.",
      lessons: [
        "Division as equal sharing",
        "Long division basics",
        "Remainders",
        "Division word problems",
      ],
    },
    {
      id: "c4-fraction",
      topic: "fraction",
      title: "Introduction to Fractions",
      description: "Seeing fractions in everyday things like rotis and chocolate.",
      lessons: [
        "Halves, thirds & quarters",
        "Fractions of a group",
        "Comparing simple fractions",
      ],
    },
    {
      id: "c4-geometry",
      topic: "geometry",
      title: "Shapes, Patterns & Measurement",
      description: "Exploring 2D shapes and measuring the world around us.",
      lessons: [
        "2D shapes & their sides",
        "Perimeter of simple shapes",
        "Measuring length, weight & capacity",
      ],
    },
  ],
  "5": [
    {
      id: "c5-multiply",
      topic: "multiply",
      title: "Multiplication & Factors",
      description: "Multiplying large numbers and meeting factors and multiples.",
      lessons: [
        "Multiplying large numbers",
        "Factors & multiples",
        "Prime & composite numbers",
      ],
    },
    {
      id: "c5-divide",
      topic: "divide",
      title: "Division & Long Division",
      description: "Confident long division with bigger divisors.",
      lessons: [
        "Long division (2-digit divisors)",
        "Division with remainders",
        "Estimation in division",
      ],
    },
    {
      id: "c5-fraction",
      topic: "fraction",
      title: "Fractions",
      description: "Equivalent fractions and adding fractions together.",
      lessons: [
        "Equivalent fractions",
        "Adding & subtracting like fractions",
        "Mixed numbers",
      ],
    },
    {
      id: "c5-decimal",
      topic: "decimal",
      title: "Decimals",
      description: "Understanding tenths and hundredths in money and measurement.",
      lessons: [
        "Tenths & hundredths",
        "Comparing decimals",
        "Adding & subtracting decimals",
      ],
    },
    {
      id: "c5-geometry",
      topic: "geometry",
      title: "Geometry & Measurement",
      description: "Angles, area and symmetry in shapes.",
      lessons: [
        "Angles & their types",
        "Area & perimeter of rectangles",
        "Symmetry",
      ],
    },
  ],
  "6": [
    {
      id: "c6-add_subtract",
      topic: "add_subtract",
      title: "Integers & Whole Numbers",
      description: "Stepping into negative numbers and the number line.",
      lessons: [
        "Negative numbers",
        "Adding & subtracting integers",
        "The number line",
      ],
    },
    {
      id: "c6-divide",
      topic: "divide",
      title: "Factors, Multiples & Division",
      description: "HCF, LCM and divisibility rules.",
      lessons: [
        "HCF & LCM",
        "Divisibility rules",
        "Prime factorisation",
      ],
    },
    {
      id: "c6-fraction",
      topic: "fraction",
      title: "Fractions & Decimals",
      description: "Operating on fractions and converting to decimals.",
      lessons: [
        "Operations on fractions",
        "Decimals & place value",
        "Converting fractions ↔ decimals",
      ],
    },
    {
      id: "c6-ratio",
      topic: "ratio",
      title: "Ratio & Proportion",
      description: "Comparing quantities with ratios and the unitary method.",
      lessons: [
        "Understanding ratios",
        "Equivalent ratios",
        "The unitary method",
      ],
    },
    {
      id: "c6-percent",
      topic: "percent",
      title: "Percentages",
      description: "Percentages as fractions and simple discounts.",
      lessons: [
        "Percentage as a fraction",
        "Finding a percentage of a number",
        "Simple discounts",
      ],
    },
    {
      id: "c6-algebra",
      topic: "algebra",
      title: "Introduction to Algebra",
      description: "Using letters for numbers and forming expressions.",
      lessons: [
        "Using letters for numbers",
        "Simple expressions",
        "Forming equations",
      ],
    },
    {
      id: "c6-geometry",
      topic: "geometry",
      title: "Geometry & Mensuration",
      description: "Lines, angles, triangles and basic area.",
      lessons: [
        "Lines, angles & triangles",
        "Perimeter & area",
        "Basic 3D shapes",
      ],
    },
  ],
  "7": [
    {
      id: "c7-add_subtract",
      topic: "add_subtract",
      title: "Integers",
      description: "All four operations on positive and negative integers.",
      lessons: [
        "Operations on integers",
        "Properties of integers",
        "Word problems with integers",
      ],
    },
    {
      id: "c7-fraction",
      topic: "fraction",
      title: "Fractions & Decimals",
      description: "Multiplying and dividing fractions and decimals.",
      lessons: [
        "Multiplying & dividing fractions",
        "Operations on decimals",
        "Word problems",
      ],
    },
    {
      id: "c7-ratio",
      topic: "ratio",
      title: "Ratio & Proportion",
      description: "Proportion, the unitary method and speed-distance-time.",
      lessons: [
        "Direct proportion",
        "The unitary method",
        "Speed, distance & time",
      ],
    },
    {
      id: "c7-percent",
      topic: "percent",
      title: "Percentage, Profit & Loss",
      description: "Percentage change, profit, loss and simple interest.",
      lessons: [
        "Percentage change",
        "Profit & loss",
        "Simple interest",
      ],
    },
    {
      id: "c7-algebra",
      topic: "algebra",
      title: "Simple Equations & Algebra",
      description: "Building and solving simple equations.",
      lessons: [
        "Algebraic expressions",
        "Solving simple equations",
        "Word problems with equations",
      ],
    },
    {
      id: "c7-geometry",
      topic: "geometry",
      title: "Lines, Angles & Triangles",
      description: "Angle pairs, triangle properties and congruence.",
      lessons: [
        "Pairs of angles",
        "Properties of triangles",
        "Congruence of triangles",
      ],
    },
    {
      id: "c7-mensuration",
      topic: "geometry",
      title: "Perimeter, Area & Mensuration",
      description: "Area of triangles, parallelograms and circles.",
      lessons: [
        "Area of triangles & parallelograms",
        "Circumference & area of a circle",
        "Mensuration word problems",
      ],
    },
  ],
};

/** Normalise an untrusted class value into a known curriculum class, or null. */
export function normalizeCurriculumClass(value: unknown): CurriculumClass | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return (CURRICULUM_CLASSES as readonly string[]).includes(trimmed)
    ? (trimmed as CurriculumClass)
    : null;
}

/** Curriculum units for a class, or an empty array for an unknown class. */
export function getCurriculum(studentClass: unknown): CurriculumUnit[] {
  const cls = normalizeCurriculumClass(studentClass);
  return cls ? CURRICULUM[cls] : [];
}

/** Render one class's units either fully (with lessons) or as a topic list. */
function renderClassSyllabus(cls: CurriculumClass, detailed: boolean): string {
  const units = CURRICULUM[cls];
  if (detailed) {
    return units.map((u) => `  • ${u.title}: ${u.lessons.join("; ")}`).join("\n");
  }
  return units.map((u) => u.title).join(", ");
}

/**
 * Builds a compact, board-aware summary of the real Classes 4–7 Indian maths
 * syllabus to anchor the AI prompts (student tutor, parent counsellor, tutor
 * coach) in the actual curriculum.
 *
 * When `studentClass` is a known class, that class is detailed in full and the
 * other classes are summarised as topic lists (so the AI understands the
 * progression). When it is null/unknown (e.g. a tutor with no student selected),
 * all four classes are detailed in full.
 */
export function buildSyllabusKnowledge(
  studentClass: string | null,
  board: string | null,
): string {
  const cls = normalizeCurriculumClass(studentClass);
  const boardName = (board ?? "").trim() || "CBSE";

  const lines: string[] = [
    `INDIAN MATHS SYLLABUS KNOWLEDGE (Classes 4–7):`,
    `Across Indian school boards — CBSE/NCERT, ICSE (CISCE) and the State Boards (e.g. Maharashtra SSC, Tamil Nadu, Karnataka, UP, West Bengal, etc.) — the core Classes 4–7 maths topics are broadly common, though depth, sequencing, vocabulary and real-life contexts vary by board. The standard topic coverage is:`,
  ];

  for (const c of CURRICULUM_CLASSES) {
    if (cls && c === cls) {
      lines.push(`- Class ${c} (THIS LEARNER'S CLASS — know this in detail):`);
      lines.push(renderClassSyllabus(c, true));
    } else if (cls) {
      lines.push(`- Class ${c}: ${renderClassSyllabus(c, false)}`);
    } else {
      lines.push(`- Class ${c}:`);
      lines.push(renderClassSyllabus(c, true));
    }
  }

  lines.push(
    ``,
    `BOARD AWARENESS:`,
    summarizeBoardsForPrompt(),
    `- This learner follows the ${boardName} board. Tailor the topics, depth, vocabulary and examples to what the ${boardName} board expects at this class level.`,
    `- CBSE/NCERT is the most common and is the baseline above. ICSE (CISCE) generally covers the same topics with a little more breadth and earlier formal vocabulary. State, UT, open-schooling, madrasa and Sanskrit boards all follow the same NCERT-aligned Classes 4–7 maths core but often localise examples, currency, names and contexts and may reorder chapters across the year. International boards (IB, IGCSE) use enquiry-led framing but cover the same arithmetic, fractions, geometry and data foundations at this level.`,
    `- Whatever Indian board the learner names, you know its Classes 4–7 maths syllabus: map it to this NCERT-aligned core and adjust depth, sequencing and vocabulary to that board. Stay within the learner's class level: build only on what they would already have met in earlier classes, and do not jump ahead to topics meant for higher classes.`,
  );

  return lines.join("\n");
}

/** Why a particular lesson is recommended — the frontend localises this code. */
export type RecommendationReason =
  | "not_started"
  | "needs_practice"
  | "low_score"
  | "next_up";

export interface LessonRecommendation {
  unitId: string;
  topic: Topic;
  title: string;
  lesson: string;
  reason: RecommendationReason;
  mastery: number;
}

/** Activity baseline: 8 practised questions ≈ "confident" (100%). */
function activityMastery(practiced: number): number {
  return Math.min(100, Math.round(practiced * 12.5));
}

const MASTERED_THRESHOLD = 70;
const LOW_SCORE_THRESHOLD = 50;

/**
 * Pick up to three "next lessons" for a student, walking the class curriculum in
 * order. A unit's mastery blends chat-practice activity with the best graded-test
 * score for that topic (a test is a stronger signal). Units already mastered are
 * skipped; if every unit is mastered we surface the next class's first unit as an
 * enrichment suggestion (`next_up`).
 */
export function recommendNextLessons(
  studentClass: unknown,
  topicCounts: Map<string, number>,
  assessmentPctByTopic: Map<string, number>,
): { recommendations: LessonRecommendation[]; allMastered: boolean } {
  const cls = normalizeCurriculumClass(studentClass);
  if (!cls) return { recommendations: [], allMastered: false };

  const units = CURRICULUM[cls];
  const masteryFor = (topic: Topic): number => {
    const activity = activityMastery(topicCounts.get(topic) ?? 0);
    const testPct = assessmentPctByTopic.get(topic);
    // A graded test is the stronger signal, so weight it heavily; chat practice
    // only nudges the estimate. With no test we fall back to activity alone.
    // (e.g. test 100% / no practice ⇒ 70, still counts as mastered.)
    return testPct === undefined
      ? activity
      : Math.round(testPct * 0.7 + activity * 0.3);
  };

  const recommendations: LessonRecommendation[] = [];
  const seenTopics = new Set<string>();

  for (const unit of units) {
    if (recommendations.length >= 3) break;
    if (seenTopics.has(unit.topic)) continue;
    const mastery = masteryFor(unit.topic);
    if (mastery >= MASTERED_THRESHOLD) continue;

    const practiced = topicCounts.get(unit.topic) ?? 0;
    const testPct = assessmentPctByTopic.get(unit.topic);
    let reason: RecommendationReason;
    if (testPct !== undefined && testPct < LOW_SCORE_THRESHOLD) {
      reason = "low_score";
    } else if (practiced === 0 && testPct === undefined) {
      reason = "not_started";
    } else {
      reason = "needs_practice";
    }

    recommendations.push({
      unitId: unit.id,
      topic: unit.topic,
      title: unit.title,
      lesson: unit.lessons[0] ?? unit.title,
      reason,
      mastery,
    });
    seenTopics.add(unit.topic);
  }

  if (recommendations.length === 0) {
    // Everything in this class is mastered — suggest the next class's first unit.
    const idx = CURRICULUM_CLASSES.indexOf(cls);
    const nextCls = CURRICULUM_CLASSES[idx + 1];
    if (nextCls) {
      const unit = CURRICULUM[nextCls][0];
      recommendations.push({
        unitId: unit.id,
        topic: unit.topic,
        title: unit.title,
        lesson: unit.lessons[0] ?? unit.title,
        reason: "next_up",
        mastery: 0,
      });
    }
    return { recommendations, allMastered: true };
  }

  return { recommendations, allMastered: false };
}
