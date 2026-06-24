import { pgTable, text, serial, timestamp, integer, jsonb, index } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import type { AssessmentQuestion } from "./assessments";

/** A mock-exam question carries its source topic so results can be broken down. */
export interface MockQuestion extends AssessmentQuestion {
  topic: string;
}

/**
 * A full-length, timed practice paper spanning several topics — a "mock exam"
 * that simulates real board-exam conditions. Like graded assessments, the
 * questions + answer key are generated server-side and held here so the key
 * never leaves the server until the paper is submitted. A row is created on
 * start (`status: "pending"`) and finalised on submit (`status: "completed"`).
 */
export const mockExamsTable = pgTable(
  "mock_exams",
  {
    id: serial("id").primaryKey(),
    examId: text("exam_id").notNull().unique(),
    studentVidyaId: text("student_vidya_id")
      .notNull()
      .references(() => usersTable.vidyaId, { onDelete: "cascade" }),
    // The mix of topics this paper draws from.
    topics: text("topics").array().notNull(),
    questions: jsonb("questions").$type<MockQuestion[]>().notNull(),
    totalQuestions: integer("total_questions").notNull(),
    // Allotted time limit in seconds.
    durationSec: integer("duration_sec").notNull(),
    pointsPerCorrect: integer("points_per_correct").notNull().default(10),
    status: text("status").notNull().default("pending"),
    correctCount: integer("correct_count"),
    score: integer("score"),
    submittedAnswers: jsonb("submitted_answers").$type<number[]>(),
    // Seconds the student actually took, captured on submit.
    timeTakenSec: integer("time_taken_sec"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [index("mock_exams_student_idx").on(t.studentVidyaId, t.createdAt)],
);
