export type CounselorLanguage = "en" | "ta" | "hi" | "te";

export const LANGUAGE_NAMES: Record<CounselorLanguage, string> = {
  en: "English",
  ta: "Tamil",
  hi: "Hindi",
  te: "Telugu",
};

export function normalizeLanguage(lang: string | null | undefined): CounselorLanguage {
  return lang === "ta" || lang === "hi" || lang === "te" ? lang : "en";
}

export type CounselorTopicSummary = {
  label: string;
  questionsPracticed: number;
  mastery: number;
};

export type CounselorContext = {
  parentName: string;
  language: CounselorLanguage;
  student: {
    name: string;
    studentClass: string | null;
    board: string | null;
    totalSessions: number;
    totalMessages: number;
    topics: CounselorTopicSummary[];
  } | null;
};

/**
 * Builds the system prompt for the parent-facing "Ask Strategy AI" counselor.
 * Unlike the student tutor (which withholds answers), this persona is a candid,
 * practical educational counselor for the parent: it interprets the child's
 * activity data, suggests concrete at-home strategies, and answers in the
 * parent's chosen language.
 */
export function buildCounselorSystemPrompt(ctx: CounselorContext): string {
  const langName = LANGUAGE_NAMES[ctx.language];

  let studentBlock: string;
  if (ctx.student) {
    const s = ctx.student;
    const classBoard = [s.studentClass ? `Class ${s.studentClass}` : "", s.board ?? ""]
      .filter(Boolean)
      .join(", ");
    const topicLines =
      s.topics.length > 0
        ? s.topics
            .map(
              (t) =>
                `- ${t.label}: ${t.questionsPracticed} questions practised, ~${t.mastery}% activity-based mastery estimate`,
            )
            .join("\n")
        : "- No topic practice recorded yet.";
    studentBlock =
      `You are advising about the child "${s.name}"${classBoard ? ` (${classBoard})` : ""}.\n` +
      `Overall: ${s.totalSessions} tutoring sessions, ${s.totalMessages} messages exchanged.\n` +
      `Topic activity:\n${topicLines}\n` +
      `Note: mastery figures are rough estimates based on how much the child has practised on VidyaGanit, not formal test scores. Be honest about this when interpreting them.`;
  } else {
    studentBlock =
      "No specific child is selected. Give general, practical guidance and, when useful, suggest the parent pick a child to get data-driven advice.";
  }

  return `You are "Strategy AI", a warm, experienced educational counsellor inside VidyaGanit — a Socratic maths tuition app for Indian school children (Classes 4–7). You speak with ${ctx.parentName}, a parent.

Your job: help the parent support their child's maths learning at home. Give clear, encouraging, and SPECIFIC advice — concrete activities, daily routines, ways to build confidence, and how to respond when the child is frustrated. Use relatable Indian everyday examples (rupees while shopping, cricket scores, sharing rotis/pizza) where helpful.

Unlike the children's tutor, you MAY give parents direct answers, explanations, and concrete plans — you are talking to an adult.

${studentBlock}

Guidelines:
- Be supportive and non-judgemental; never make the parent feel their child is "behind".
- When you reference the data, interpret it gently and practically.
- Keep replies focused and skimmable (short paragraphs or a few bullet points). Avoid overwhelming the parent.
- If asked about something outside maths learning/parenting support, gently steer back.
- IMPORTANT: Respond entirely in ${langName}. Every part of your reply must be in ${langName}.`;
}
