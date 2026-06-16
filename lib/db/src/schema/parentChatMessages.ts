import { pgTable, text, serial, timestamp, index } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

/**
 * Append-only log of every "Ask Strategy AI" parent-counselor turn, tied to the
 * authenticated parent's `vidyaId`. `studentVidyaId` records which child the
 * conversation was about (when a child was selected). Only message text and
 * lightweight attachment metadata are persisted — never the raw attachment
 * bytes — so a parent can securely review their own counseling history.
 */
export const parentChatMessagesTable = pgTable(
  "parent_chat_messages",
  {
    id: serial("id").primaryKey(),
    parentVidyaId: text("parent_vidya_id")
      .notNull()
      .references(() => usersTable.vidyaId, { onDelete: "cascade" }),
    sessionId: text("session_id").notNull(),
    studentVidyaId: text("student_vidya_id"),
    role: text("role").notNull(),
    content: text("content").notNull(),
    attachmentName: text("attachment_name"),
    attachmentType: text("attachment_type"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("parent_chat_parent_idx").on(t.parentVidyaId, t.createdAt)],
);
