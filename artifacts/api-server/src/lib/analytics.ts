import { and, eq } from "drizzle-orm";
import { db, chatMessagesTable } from "@workspace/db";
import { detectTopic } from "./tutor";

// The three curriculum focus areas surfaced on the Progress Analytics tab.
export const ANALYTICS_TOPICS: { key: "fraction" | "decimal" | "divide"; label: string }[] = [
  { key: "fraction", label: "Fractions" },
  { key: "decimal", label: "Decimals" },
  { key: "divide", label: "Long Division" },
];

export interface TopicMastery {
  key: string;
  label: string;
  questionsPracticed: number;
  sessions: number;
  mastery: number;
}

export interface StudentActivityAnalytics {
  totalSessions: number;
  totalMessages: number;
  topics: TopicMastery[];
}

// Compute per-topic practice analytics for a student from their own chat
// messages. Shared by the parent/tutor view and the student's self view.
export async function computeStudentAnalytics(
  studentVidyaId: string,
): Promise<StudentActivityAnalytics> {
  const rows = await db
    .select({
      sessionId: chatMessagesTable.sessionId,
      content: chatMessagesTable.content,
    })
    .from(chatMessagesTable)
    .where(
      and(
        eq(chatMessagesTable.studentVidyaId, studentVidyaId),
        eq(chatMessagesTable.role, "user"),
      ),
    );

  const allSessions = new Set<string>();
  const perTopic = new Map<string, { count: number; sessions: Set<string> }>();
  for (const t of ANALYTICS_TOPICS) {
    perTopic.set(t.key, { count: 0, sessions: new Set() });
  }

  for (const row of rows) {
    allSessions.add(row.sessionId);
    const topic = detectTopic(row.content);
    const bucket = perTopic.get(topic);
    if (bucket) {
      bucket.count += 1;
      bucket.sessions.add(row.sessionId);
    }
  }

  const topics = ANALYTICS_TOPICS.map((t) => {
    const bucket = perTopic.get(t.key)!;
    // Honest, activity-based estimate: each practised question contributes
    // toward an 8-question "confident" baseline, capped at 100%.
    const mastery = Math.min(100, Math.round(bucket.count * 12.5));
    return {
      key: t.key,
      label: t.label,
      questionsPracticed: bucket.count,
      sessions: bucket.sessions.size,
      mastery,
    };
  });

  return { totalSessions: allSessions.size, totalMessages: rows.length, topics };
}
