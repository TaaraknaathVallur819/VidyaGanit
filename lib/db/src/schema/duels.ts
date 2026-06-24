import { pgTable, text, serial, timestamp, integer, jsonb, index } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import type { AssessmentQuestion } from "./assessments";

/**
 * An asynchronous 1-vs-1 math duel between two classmates in the same batch.
 * The challenger starts the duel (questions generated + held server-side, answer
 * key never leaves the server until both have played). Each side submits answers
 * independently; when both have submitted, the duel is `completed`, scores are
 * compared and a winner is derived. XP is granted once per participant on submit.
 */
export const duelsTable = pgTable(
  "duels",
  {
    id: serial("id").primaryKey(),
    duelId: text("duel_id").notNull().unique(),
    challengerVidyaId: text("challenger_vidya_id")
      .notNull()
      .references(() => usersTable.vidyaId, { onDelete: "cascade" }),
    opponentVidyaId: text("opponent_vidya_id")
      .notNull()
      .references(() => usersTable.vidyaId, { onDelete: "cascade" }),
    // The shared batch both students belong to (duels are within a batch).
    batch: text("batch"),
    questions: jsonb("questions").$type<AssessmentQuestion[]>().notNull(),
    challengerAnswers: jsonb("challenger_answers").$type<number[]>(),
    opponentAnswers: jsonb("opponent_answers").$type<number[]>(),
    challengerScore: integer("challenger_score"),
    opponentScore: integer("opponent_score"),
    // pending | completed.
    status: text("status").notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [
    index("duels_challenger_idx").on(t.challengerVidyaId, t.createdAt),
    index("duels_opponent_idx").on(t.opponentVidyaId, t.createdAt),
  ],
);
