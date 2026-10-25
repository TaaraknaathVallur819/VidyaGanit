import {
  boolean,
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { feePaymentsTable } from "./fees";
import { usersTable } from "./users";

export const subscriptionsTable = pgTable(
  "subscriptions",
  {
    id: serial("id").primaryKey(),
    ownerVidyaId: text("owner_vidya_id")
      .notNull()
      .references(() => usersTable.vidyaId, { onDelete: "cascade" }),
    planCode: text("plan_code").notNull(),
    billingCycle: text("billing_cycle").notNull(),
    amountPaise: integer("amount_paise").notNull().default(0),
    currency: text("currency").notNull().default("INR"),
    status: text("status").notNull().default("Pending"),
    providerSubscriptionId: text("provider_subscription_id").notNull().unique(),
    providerPlanId: text("provider_plan_id").notNull(),
    providerPaymentId: text("provider_payment_id"),
    currentStart: timestamp("current_start", { withTimezone: true }),
    currentEnd: timestamp("current_end", { withTimezone: true }),
    cancelAtCycleEnd: boolean("cancel_at_cycle_end").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("subscriptions_owner_idx").on(t.ownerVidyaId),
    index("subscriptions_status_idx").on(t.status),
  ],
);

export const paymentOrdersTable = pgTable(
  "payment_orders",
  {
    id: serial("id").primaryKey(),
    kind: text("kind").notNull(),
    providerOrderId: text("provider_order_id").notNull().unique(),
    providerPaymentId: text("provider_payment_id").unique(),
    providerTransferId: text("provider_transfer_id"),
    payerVidyaId: text("payer_vidya_id")
      .notNull()
      .references(() => usersTable.vidyaId, { onDelete: "cascade" }),
    tutorVidyaId: text("tutor_vidya_id")
      .references(() => usersTable.vidyaId, { onDelete: "cascade" }),
    studentVidyaId: text("student_vidya_id")
      .references(() => usersTable.vidyaId, { onDelete: "cascade" }),
    feePaymentId: integer("fee_payment_id")
      .references(() => feePaymentsTable.id, { onDelete: "restrict" }),
    amountPaise: integer("amount_paise").notNull(),
    currency: text("currency").notNull().default("INR"),
    platformFeePaise: integer("platform_fee_paise").notNull(),
    gstPaise: integer("gst_paise").notNull().default(0),
    transferAmountPaise: integer("transfer_amount_paise").notNull(),
    status: text("status").notNull().default("Pending"),
    receipt: text("receipt").notNull().unique(),
    signature: text("signature"),
    errorMessage: text("error_message"),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("payment_orders_payer_idx").on(t.payerVidyaId),
    index("payment_orders_fee_idx").on(t.feePaymentId),
    index("payment_orders_status_idx").on(t.status),
  ],
);
