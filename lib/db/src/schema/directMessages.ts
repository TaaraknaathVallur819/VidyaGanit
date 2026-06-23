import {
  pgTable,
  serial,
  text,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// A 1:1 message between a tutor and a parent who share at least one student.
// A "thread" is the (tutorVidyaId, parentVidyaId) pair; `senderRole` is "tutor"
// or "parent". `readAt` is set when the recipient opens the thread.
export const directMessagesTable = pgTable(
  "direct_messages",
  {
    id: serial("id").primaryKey(),
    tutorVidyaId: text("tutor_vidya_id").notNull(),
    parentVidyaId: text("parent_vidya_id").notNull(),
    senderRole: text("sender_role").notNull(),
    body: text("body").notNull(),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("direct_messages_thread_idx").on(t.tutorVidyaId, t.parentVidyaId),
  ],
);

export const insertDirectMessageSchema = createInsertSchema(
  directMessagesTable,
).omit({ id: true, createdAt: true });
export type InsertDirectMessage = z.infer<typeof insertDirectMessageSchema>;
export type DirectMessage = typeof directMessagesTable.$inferSelect;
