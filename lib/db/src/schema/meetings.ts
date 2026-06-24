import { pgTable, text, serial, timestamp, integer, index } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

/**
 * A parent–tutor meeting proposed inside their messaging relationship. Either
 * party may propose a slot (they must already share a student); the other party
 * confirms or declines. Mirrors the 1:1 messaging pairing keyed by
 * (tutorVidyaId, parentVidyaId).
 */
export const meetingsTable = pgTable(
  "meetings",
  {
    id: serial("id").primaryKey(),
    tutorVidyaId: text("tutor_vidya_id")
      .notNull()
      .references(() => usersTable.vidyaId, { onDelete: "cascade" }),
    parentVidyaId: text("parent_vidya_id")
      .notNull()
      .references(() => usersTable.vidyaId, { onDelete: "cascade" }),
    // The child the meeting concerns (optional context).
    studentVidyaId: text("student_vidya_id"),
    // Which role proposed the slot: tutor | parent.
    proposedBy: text("proposed_by").notNull(),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
    durationMin: integer("duration_min").notNull().default(30),
    note: text("note"),
    // pending | confirmed | declined | cancelled.
    status: text("status").notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("meetings_tutor_idx").on(t.tutorVidyaId, t.scheduledAt),
    index("meetings_parent_idx").on(t.parentVidyaId, t.scheduledAt),
  ],
);
