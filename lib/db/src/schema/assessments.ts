import { pgTable, text, serial, timestamp, integer, jsonb, index } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

/**
 * A topic-mastery test (quiz/worksheet) the AI tutor offers a student once they
 * are comfortable with a topic. A row is created when the test is generated
 * (`status: "pending"`, holding the questions + correct answers server-side so
 * the answer key never leaves the server) and finalised on submit
 * (`status: "completed"` with the score). No negative marking: the score is
 * simply `correctCount * pointsPerCorrect`.
 *
 * Completed rows are the source of truth for the progress reports shown in the
 * parent and tutor portals.
 */
export interface AssessmentQuestion {
  prompt: string;
  options: string[];
  /** Index into `options` of the correct choice. */
  answerIndex: number;
}

export const assessmentsTable = pgTable(
  "assessments",
  {
    id: serial("id").primaryKey(),
    testId: text("test_id").notNull().unique(),
    studentVidyaId: text("student_vidya_id")
      .notNull()
      .references(() => usersTable.vidyaId, { onDelete: "cascade" }),
    topic: text("topic").notNull(),
    topicLabel: text("topic_label").notNull(),
    questions: jsonb("questions").$type<AssessmentQuestion[]>().notNull(),
    pointsPerCorrect: integer("points_per_correct").notNull().default(10),
    totalQuestions: integer("total_questions").notNull(),
    status: text("status").notNull().default("pending"),
    correctCount: integer("correct_count"),
    score: integer("score"),
    // The student's chosen option index per question, captured on submit. Used
    // to reconstruct missed questions for the Mistake Notebook. Null for tests
    // that were generated before this column existed or never submitted.
    submittedAnswers: jsonb("submitted_answers").$type<number[]>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [
    index("assessments_student_idx").on(t.studentVidyaId, t.createdAt),
    index("assessments_status_idx").on(t.status),
  ],
);
