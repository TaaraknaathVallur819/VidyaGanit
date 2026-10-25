import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, feePaymentsTable, paymentOrdersTable, subscriptionsTable } from "@workspace/db";
import { verifyWebhook } from "../lib/razorpay";

const router: IRouter = Router();

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
      const subStatus =
        event.event === "subscription.activated" || event.event === "subscription.charged"
          ? "Success"
          : event.event === "subscription.cancelled"
          ? "Failed"
          : "Pending";

      await db
        .update(subscriptionsTable)
        .set({
          status: subStatus,
          currentStart: subscription.current_start
            ? new Date(Number(subscription.current_start) * 1000)
            : null,
          currentEnd: subscription.current_end
            ? new Date(Number(subscription.current_end) * 1000)
            : null,
          updatedAt: new Date(),
        })
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
