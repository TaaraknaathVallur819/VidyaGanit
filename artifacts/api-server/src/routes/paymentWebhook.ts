import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, feePaymentsTable, paymentOrdersTable, subscriptionsTable } from "@workspace/db";
import { verifyWebhook } from "../lib/razorpay";

const router: IRouter = Router();

// Events that mean the customer has paid / is paying, and events that mean the
// subscription no longer entitles them to anything. Every other event (e.g.
// subscription.updated, subscription.authenticated) leaves the status alone,
// so an unrelated notification can never switch a paying customer off.
const SUBSCRIPTION_GRANTED = ["subscription.activated", "subscription.charged", "subscription.resumed"];
const SUBSCRIPTION_ENDED = [
  "subscription.cancelled",
  "subscription.completed",
  "subscription.halted",
  "subscription.paused",
];

router.post("/", async (req, res): Promise<void> => {
  const signature = String(req.header("x-razorpay-signature") ?? "");
  const raw = req.body as Buffer;

  // Strict cryptographic signature verification to prevent spoofing
  if (!Buffer.isBuffer(raw) || !verifyWebhook(raw, signature)) {
    res.status(400).json({ error: "Invalid webhook signature." });
    return;
  }

  try {
    const event = JSON.parse(raw.toString("utf8")) as {
      event?: string;
      payload?: {
        subscription?: { entity?: Record<string, unknown> };
        payment?: { entity?: Record<string, unknown> };
        order?: { entity?: Record<string, unknown> };
      };
    };

    // 1. Handle subscription lifecycle events
    const subscription = event.payload?.subscription?.entity;
    if (subscription?.id && event.event?.startsWith("subscription.")) {
      const update: Partial<typeof subscriptionsTable.$inferInsert> = { updatedAt: new Date() };
      if (SUBSCRIPTION_GRANTED.includes(event.event!)) update.status = "Success";
      else if (SUBSCRIPTION_ENDED.includes(event.event!)) update.status = "Failed";
      // Only ever move the period dates when Razorpay actually sends them.
      if (subscription.current_start) {
        update.currentStart = new Date(Number(subscription.current_start) * 1000);
      }
      if (subscription.current_end) {
        update.currentEnd = new Date(Number(subscription.current_end) * 1000);
      }

      await db
        .update(subscriptionsTable)
        .set(update)
        .where(eq(subscriptionsTable.providerSubscriptionId, String(subscription.id)));
    }

    // 2. Handle payment.captured event
    const payment = event.payload?.payment?.entity;
    if (event.event === "payment.captured" && payment?.order_id && payment.id) {
      const orderId = String(payment.order_id);
      const [local] = await db
        .select()
        .from(paymentOrdersTable)
        .where(eq(paymentOrdersTable.providerOrderId, orderId))
        .limit(1);

      if (local && Number(payment.amount) === local.amountPaise) {
        await db.transaction(async (tx) => {
          await tx
            .update(paymentOrdersTable)
            .set({
              providerPaymentId: String(payment.id),
              status: "Success", // Status state: Success
              paidAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(paymentOrdersTable.id, local.id));

          if (local.feePaymentId) {
            await tx
              .update(feePaymentsTable)
              .set({
                status: "paid",
                method: "razorpay",
                paidOn: new Date().toISOString().slice(0, 10),
              })
              .where(eq(feePaymentsTable.id, local.feePaymentId));
          }
        });
      }
    }

    // 3. Handle payment.failed event
    if (event.event === "payment.failed" && payment?.order_id) {
      const orderId = String(payment.order_id);
      const errorDesc = String(
        (payment.error_description as string) || "Payment failed at payment gateway",
      );

      await db
        .update(paymentOrdersTable)
        .set({
          status: "Failed", // Status state: Failed
          errorMessage: errorDesc,
          updatedAt: new Date(),
        })
        .where(eq(paymentOrdersTable.providerOrderId, orderId));
    }

    res.json({ ok: true });
  } catch (err: unknown) {
    res.status(500).json({ error: "Webhook processing error" });
  }
});

export default router;
