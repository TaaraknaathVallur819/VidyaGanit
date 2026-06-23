import {
  pgTable,
  serial,
  text,
  integer,
  real,
  date,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Spaced-repetition state for a single missed question. Mistakes themselves are
// derived on read from graded assessments; a review item is seeded the first
// time a student opens Smart Review and then scheduled with an SM-2-style
// algorithm. `mistakeKey` is a stable signature so the same mistake isn't
// tracked twice. `question` snapshots the prompt so review survives even if the
// source assessment is later filtered out.
export const reviewItemsTable = pgTable(
  "review_items",
  {
    id: serial("id").primaryKey(),
    vidyaId: text("vidya_id").notNull(),
    mistakeKey: text("mistake_key").notNull(),
    question: text("question").notNull(),
    topic: text("topic"),
    intervalDays: integer("interval_days").notNull().default(0),
    ease: real("ease").notNull().default(2.5),
    repetitions: integer("repetitions").notNull().default(0),
    dueDate: date("due_date", { mode: "string" }).notNull(),
    lastReviewedAt: timestamp("last_reviewed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [unique("review_item_unique").on(t.vidyaId, t.mistakeKey)],
);

export const insertReviewItemSchema = createInsertSchema(reviewItemsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertReviewItem = z.infer<typeof insertReviewItemSchema>;
export type ReviewItem = typeof reviewItemsTable.$inferSelect;
