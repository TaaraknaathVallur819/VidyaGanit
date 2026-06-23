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

// A piece of work a tutor assigns to a whole batch. `kind` is "practice"
// (do topic practice in chat) or "test" (take a topic assessment). Completion
// is tracked per student in assignmentCompletionsTable.
export const assignmentsTable = pgTable(
  "assignments",
  {
    id: serial("id").primaryKey(),
    tutorVidyaId: text("tutor_vidya_id").notNull(),
    batch: text("batch").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    kind: text("kind").notNull(),
    topic: text("topic"),
    dueDate: date("due_date", { mode: "string" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("assignments_tutor_idx").on(t.tutorVidyaId)],
);

export const assignmentCompletionsTable = pgTable(
  "assignment_completions",
  {
    id: serial("id").primaryKey(),
    assignmentId: integer("assignment_id").notNull(),
    studentVidyaId: text("student_vidya_id").notNull(),
    status: text("status").notNull().default("pending"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [
    unique("assignment_completion_unique").on(
      t.assignmentId,
      t.studentVidyaId,
    ),
  ],
);

export const insertAssignmentSchema = createInsertSchema(assignmentsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertAssignment = z.infer<typeof insertAssignmentSchema>;
export type Assignment = typeof assignmentsTable.$inferSelect;
export type AssignmentCompletion =
  typeof assignmentCompletionsTable.$inferSelect;
