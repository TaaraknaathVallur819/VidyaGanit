import { pgTable, text, serial, integer, timestamp, date, index } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

// Tuition fee payment records. A tutor records, per linked student, whether a
// fee was paid, how much, and by which method. Records are scoped by
// `tutorVidyaId` so each tutor only ever sees the payments they logged.
export const feePaymentsTable = pgTable(
  "fee_payments",
  {
    id: serial("id").primaryKey(),
    tutorVidyaId: text("tutor_vidya_id")
      .notNull()
      .references(() => usersTable.vidyaId, { onDelete: "cascade" }),
    studentVidyaId: text("student_vidya_id")
      .notNull()
      .references(() => usersTable.vidyaId, { onDelete: "cascade" }),
    // Amount in whole rupees.
    amount: integer("amount").notNull(),
    // How the fee was paid: cash | upi | card | bank_transfer | cheque | other.
    method: text("method").notNull(),
    // paid | unpaid | pending.
    status: text("status").notNull().default("paid"),
    // Optional human-readable period this fee covers (e.g. "June 2026", "Term 1").
    period: text("period"),
    note: text("note"),
    // The calendar day the payment was made (YYYY-MM-DD), tutor-supplied.
    paidOn: date("paid_on", { mode: "string" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("fee_payments_tutor_idx").on(t.tutorVidyaId)],
);
