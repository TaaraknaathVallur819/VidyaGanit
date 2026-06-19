import { pgTable, text, serial, timestamp, unique } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const parentStudentLinksTable = pgTable(
  "parent_student_links",
  {
    id: serial("id").primaryKey(),
    parentVidyaId: text("parent_vidya_id")
      .notNull()
      .references(() => usersTable.vidyaId, { onDelete: "cascade" }),
    studentVidyaId: text("student_vidya_id")
      .notNull()
      .references(() => usersTable.vidyaId, { onDelete: "cascade" }),
    // Which of the tutor's batches this student belongs to. Null for parent links
    // and for tutor links left unassigned.
    batch: text("batch"),
    linkedAt: timestamp("linked_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("parent_student_unique").on(t.parentVidyaId, t.studentVidyaId)],
);
