// Cross-session "long-term memory" for the AIs.
//
// Each chat route only sends the model the CURRENT conversation's turns. To let
// the AIs refer back to earlier chats in a brand-new conversation, we build a
// compact digest of the user's own past messages (from previous sessions) and
// inject it into the system prompt as guarded, untrusted context.

export type MemoryRow = {
  role: string;
  content: string;
  createdAt: Date;
  sessionId: string;
};

export type PastConversationDigest = {
  /** How many distinct earlier conversations the user has had. */
  sessionCount: number;
  /** A compact, most-recent-last transcript of earlier turns. */
  transcript: string;
};

// Keep the memory block bounded so it never dominates the model's context
// window or cost. We surface the most recent turns across past sessions.
const MAX_MEMORY_MESSAGES = 40;
const MAX_MEMORY_MSG_LEN = 400;

/**
 * Builds a compact digest of a user's earlier conversations for prompt
 * injection. `rows` must be ordered oldest-first and may include the current
 * session's rows (they are filtered out via `currentSessionId`). Returns null
 * when there is no prior conversation to remember.
 */
export function buildPastConversationDigest(
  rows: MemoryRow[],
  currentSessionId: string,
  labels: { user: string; assistant: string },
): PastConversationDigest | null {
  const past = rows.filter((r) => r.sessionId !== currentSessionId);
  if (past.length === 0) return null;

  const sessionCount = new Set(past.map((r) => r.sessionId)).size;
  const recent = past.slice(-MAX_MEMORY_MESSAGES);

  const lines: string[] = [];
  for (const m of recent) {
    const who = m.role === "assistant" ? labels.assistant : labels.user;
    const text = m.content.replace(/\s+/g, " ").trim().slice(0, MAX_MEMORY_MSG_LEN);
    if (text) lines.push(`${who}: ${text}`);
  }
  if (lines.length === 0) return null;

  return { sessionCount, transcript: lines.join("\n") };
}
