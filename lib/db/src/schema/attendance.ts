import { pgTable, text, serial, timestamp, date, uniqueIndex, index } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

// Class attendance marked by a tutor for a linked student. One row per
// (tutor, student, sessionDate); re-marking the same day updates the row.
// Parents see the attendance of their own child only. Scoped by tutorVidyaId.
export const attendanceTable = pgTable(
  "attendance",
  {
    id: serial("id").primaryKey(),
    tutorVidyaId: text("tutor_vidya_id")
      .notNull()
      .references(() => usersTable.vidyaId, { onDelete: "cascade" }),
    studentVidyaId: text("student_vidya_id")
      .notNull()
      .references(() => usersTable.vidyaId, { onDelete: "cascade" }),
    // The calendar day of the class (YYYY-MM-DD), tutor-supplied.
    sessionDate: date("session_date", { mode: "string" }).notNull(),
    // present | absent | late.
    status: text("status").notNull(),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("attendance_unique").on(t.tutorVidyaId, t.studentVidyaId, t.sessionDate),
    index("attendance_student_idx").on(t.studentVidyaId, t.sessionDate),
  ],
);
