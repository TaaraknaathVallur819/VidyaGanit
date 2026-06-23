import {
  pgTable,
  serial,
  text,
  integer,
  date,
  timestamp,
  unique,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// A student's weekly XP target. One row per IST week (week_start = the Monday).
// `startXp` snapshots the student's cumulative XP at the moment the week's row
// is created, so weekly progress = current users.xp - startXp (clamped >= 0)
// needs no separate XP ledger.
export const weeklyGoalsTable = pgTable(
  "weekly_goals",
  {
    id: serial("id").primaryKey(),
    vidyaId: text("vidya_id").notNull(),
    weekStart: date("week_start", { mode: "string" }).notNull(),
    targetXp: integer("target_xp").notNull(),
    startXp: integer("start_xp").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique("weekly_goal_unique").on(t.vidyaId, t.weekStart),
    index("weekly_goals_vidya_idx").on(t.vidyaId),
  ],
);

export const insertWeeklyGoalSchema = createInsertSchema(weeklyGoalsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertWeeklyGoal = z.infer<typeof insertWeeklyGoalSchema>;
export type WeeklyGoal = typeof weeklyGoalsTable.$inferSelect;
