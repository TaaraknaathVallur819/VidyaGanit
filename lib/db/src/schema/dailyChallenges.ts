import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  date,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Records a student's attempt at the "Problem of the Day". The challenge itself
// is generated deterministically server-side from (date, studentClass) so there
// is no challenge table — only the per-student completion. One row per day.
export const dailyChallengeCompletionsTable = pgTable(
  "daily_challenge_completions",
  {
    id: serial("id").primaryKey(),
    vidyaId: text("vidya_id").notNull(),
    challengeDate: date("challenge_date", { mode: "string" }).notNull(),
    correct: boolean("correct").notNull(),
    xpAwarded: integer("xp_awarded").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [unique("daily_challenge_unique").on(t.vidyaId, t.challengeDate)],
);

export const insertDailyChallengeCompletionSchema = createInsertSchema(
  dailyChallengeCompletionsTable,
).omit({ id: true, createdAt: true });
export type InsertDailyChallengeCompletion = z.infer<
  typeof insertDailyChallengeCompletionSchema
>;
export type DailyChallengeCompletion =
  typeof dailyChallengeCompletionsTable.$inferSelect;
