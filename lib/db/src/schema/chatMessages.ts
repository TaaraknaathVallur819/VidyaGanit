import { pgTable, text, serial, timestamp, index } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

/**
 * Append-only log of every tutor-chat turn, tied to the student's `vidyaId`
 * and grouped by `sessionId` (one conversation). Rows are only ever inserted,
 * never updated, so a parent can later securely review their child's history.
 */
export const chatMessagesTable = pgTable(
  "chat_messages",
  {
    id: serial("id").primaryKey(),
    sessionId: text("session_id").notNull(),
    studentVidyaId: text("student_vidya_id")
      .notNull()
      .references(() => usersTable.vidyaId, { onDelete: "cascade" }),
    role: text("role").notNull(),
    content: text("content").notNull(),
    // Optional learner feedback on an assistant turn: "up" | "down" | null.
    feedback: text("feedback"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("chat_messages_student_idx").on(t.studentVidyaId, t.createdAt),
    index("chat_messages_session_idx").on(t.sessionId),
  ],
);
