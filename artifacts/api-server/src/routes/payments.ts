import { randomBytes, randomUUID } from "node:crypto";
import { Router, type IRouter, type NextFunction, type Request, type Response } from "express";
import { and, desc, eq, inArray, like } from "drizzle-orm";
import {
  db,
  feePaymentsTable,
  parentStudentLinksTable,
  paymentOrdersTable,
  subscriptionsTable,
  usersTable,
} from "@workspace/db";
import { requireAuth, requireSelf, requireTutor } from "../middlewares/auth";
import {
  DEMO_PLAN_PREFIX,
  PAYMENT_CATALOG,
  providerPlanId,
  publicCatalog,
  type BillingCycle,
  type PlanCode,
} from "../lib/paymentCatalog";
import { activePlan, requirePlan } from "../lib/planAccess";
import {
  DEMO_ACCESS_MS,
  PaymentsUnavailableError,
  calculateIndianProcessingFees,
  isDemoMode,
  paymentsConfigured,
  paymentsMode,
  razorpayKeyId,
  razorpayRequest,
  verifyCheckoutSignature,
  verifySubscriptionSignature,
} from "../lib/razorpay";

const router: IRouter = Router();

// requireSelf guarantees the :vidyaId route param equals the authenticated id, so
// read the typed session value rather than the loosely typed (string | string[]) param.
const selfId = (req: Request): string => req.vidyaId as string;

// The fee ledger only allows these methods, so map what Razorpay reports onto them.
function ledgerMethod(razorpayMethod: string | undefined): string {
  switch (razorpayMethod) {
    case "upi":
      return "upi";
    case "card":
      return "card";
    case "netbanking":
      return "bank_transfer";
    default:
      return "other";
  }
}

// Mark an order paid and, if it was a tuition fee, mark that fee paid, atomically.
async function settleOrder(
  local: { id: number; feePaymentId: number | null },
  paymentId: string,
  signature: string | null,
  method: string,
) {
  await db.transaction(async (tx) => {
    await tx
      .update(paymentOrdersTable)
      .set({
        providerPaymentId: paymentId,
        signature,
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
          method,
          paidOn: new Date().toISOString().slice(0, 10),
        })
        .where(eq(feePaymentsTable.id, local.feePaymentId));
    }
  });
}

// Public catalog with plan details and INR pricing
router.get("/payments/catalog", (_req, res) => {
  res.json({
    currency: "INR",
    mode: paymentsMode(),
    plans: publicCatalog(),
  });
});

// User payment/subscription status
router.get(
  "/payments/:vidyaId/status",
  requireAuth,
  requireSelf,
  async (req, res): Promise<void> => {
    const [user] = await db
      .select({
        role: usersTable.role,
        routeAccountId: usersTable.razorpayRouteAccountId,
        name: usersTable.name,
      })
      .from(usersTable)
      .where(eq(usersTable.vidyaId, selfId(req)))
      .limit(1);

    if (!user) {
      res.status(404).json({ error: "Account not found." });
      return;
    }

    const plan = await activePlan(selfId(req));

    // Recent orders
    const recentOrders = await db
      .select({
        id: paymentOrdersTable.id,
        orderId: paymentOrdersTable.providerOrderId,
        paymentId: paymentOrdersTable.providerPaymentId,
        amountPaise: paymentOrdersTable.amountPaise,
        currency: paymentOrdersTable.currency,
        status: paymentOrdersTable.status,
        receipt: paymentOrdersTable.receipt,
        paidAt: paymentOrdersTable.paidAt,
        createdAt: paymentOrdersTable.createdAt,
      })
      .from(paymentOrdersTable)
      .where(eq(paymentOrdersTable.payerVidyaId, selfId(req)))
      .orderBy(desc(paymentOrdersTable.createdAt))
      .limit(10);

    res.json({
      paymentsEnabled: paymentsConfigured(),
      mode: paymentsMode(),
      keyId: paymentsConfigured() ? razorpayKeyId() : null,
      // Priority support is a Tutor Pro benefit: an email address the owner configures.
      supportEmail: plan?.planCode === "tutor_pro" ? process.env.SUPPORT_EMAIL?.trim() || null : null,
      currency: "INR",
      role: user.role,
      plan: plan ? { code: plan.planCode, currentEnd: plan.currentEnd } : null,
      routeAccountId: user.role === "tutor" ? user.routeAccountId : null,
      recentOrders,
    });
  },
);

// Create subscription order for Family Plus (parent) or Tutor Pro (tutor)
router.post(
  "/payments/:vidyaId/subscriptions",
  requireAuth,
  requireSelf,
  async (req, res): Promise<void> => {
    const planCode = req.body?.planCode as PlanCode;
    const billingCycle = req.body?.billingCycle as BillingCycle;

    if (!(planCode in PAYMENT_CATALOG) || !["monthly", "yearly"].includes(billingCycle)) {
      res.status(400).json({ error: "Choose a valid plan and billing cycle." });
      return;
    }

    const [user] = await db
      .select({ role: usersTable.role, name: usersTable.name })
      .from(usersTable)
      .where(eq(usersTable.vidyaId, selfId(req)))
      .limit(1);

    const plan = PAYMENT_CATALOG[planCode];
    if (!user || user.role !== plan.role) {
      res.status(403).json({ error: `This plan is only available to ${plan.role}s.` });
      return;
    }

    if (await activePlan(selfId(req))) {
      res.status(409).json({ error: "You already have an active plan." });
      return;
    }

    const providerPlan = providerPlanId(planCode, billingCycle);
    const amountPaise = plan.prices[billingCycle];

    const subscription = await razorpayRequest<{
      id: string;
      status: string;
      current_start?: number;
      current_end?: number;
    }>("/subscriptions", {
      method: "POST",
      body: JSON.stringify({
        plan_id: providerPlan,
        total_count: billingCycle === "monthly" ? 120 : 10,
        quantity: 1,
        customer_notify: 1,
        notes: {
          vidyaId: selfId(req),
          planCode,
          billingCycle,
          currency: "INR",
        },
      }),
    });

    await db.insert(subscriptionsTable).values({
      ownerVidyaId: selfId(req),
      planCode,
      billingCycle,
      amountPaise,
      currency: "INR",
      status: "Pending", // Status state: Pending
      providerSubscriptionId: subscription.id,
      providerPlanId: providerPlan,
      currentStart: subscription.current_start ? new Date(subscription.current_start * 1000) : null,
      currentEnd: subscription.current_end ? new Date(subscription.current_end * 1000) : null,
    });

    res.status(201).json({
      mode: paymentsMode(),
      keyId: razorpayKeyId(),
      subscriptionId: subscription.id,
      name: plan.name,
      description: `${plan.name} — ${billingCycle} (INR)`,
      amount: amountPaise,
      currency: "INR",
      customerName: user.name,
    });
  },
);

// Verify subscription payment
router.post(
  "/payments/:vidyaId/subscriptions/verify",
  requireAuth,
  requireSelf,
  async (req, res): Promise<void> => {
    const paymentId = String(req.body?.razorpay_payment_id ?? "");
    const subscriptionId = String(req.body?.razorpay_subscription_id ?? "");
    const signature = String(req.body?.razorpay_signature ?? "");

    if (!verifySubscriptionSignature(paymentId, subscriptionId, signature)) {
      res.status(400).json({ error: "Payment signature verification failed." });
      return;
    }

    const [pending] = await db
      .select({ billingCycle: subscriptionsTable.billingCycle })
      .from(subscriptionsTable)
      .where(
        and(
          eq(subscriptionsTable.providerSubscriptionId, subscriptionId),
          eq(subscriptionsTable.ownerVidyaId, selfId(req)),
        ),
      )
      .limit(1);
    if (!pending) {
      res.status(404).json({ error: "Subscription not found." });
      return;
    }
    // Used only until Razorpay reports the real period end (the webhook then refines it).
    const fallbackDays = pending.billingCycle === "yearly" ? 365 : 30;

    const provider = await razorpayRequest<{
      status: string;
      current_start?: number;
      current_end?: number;
    }>(`/subscriptions/${encodeURIComponent(subscriptionId)}`);

    const updated = await db
      .update(subscriptionsTable)
      .set({
        status: "Success", // Status state: Success
        providerPaymentId: paymentId,
        currentStart: provider.current_start ? new Date(provider.current_start * 1000) : new Date(),
        currentEnd: provider.current_end
          ? new Date(provider.current_end * 1000)
          : new Date(Date.now() + fallbackDays * 86400000),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(subscriptionsTable.providerSubscriptionId, subscriptionId),
          eq(subscriptionsTable.ownerVidyaId, selfId(req)),
        ),
      )
      .returning({ id: subscriptionsTable.id });

    if (!updated.length) {
      res.status(404).json({ error: "Subscription not found." });
      return;
    }

    res.json({ ok: true, status: "Success" });
  },
);

// Demo mode only: finish a demo checkout. No money and no signature are involved,
// so it exists only while PAYMENTS_DEMO_MODE is on, only for the caller's own
// pending demo subscription, and the plan it grants is short-lived.
router.post(
  "/payments/:vidyaId/subscriptions/demo-confirm",
  requireAuth,
  requireSelf,
  async (req, res): Promise<void> => {
    if (!isDemoMode()) {
      res.status(404).json({ error: "Demo payments are not enabled." });
      return;
    }
    const subscriptionId = String(req.body?.subscriptionId ?? "");
    const now = new Date();
    const expiresAt = new Date(now.getTime() + DEMO_ACCESS_MS);
    const updated = await db
      .update(subscriptionsTable)
      .set({
        status: "Success",
        providerPaymentId: `pay_demo_${randomBytes(6).toString("hex")}`,
        currentStart: now,
        currentEnd: expiresAt,
        updatedAt: now,
      })
      .where(
        and(
          eq(subscriptionsTable.providerSubscriptionId, subscriptionId),
          eq(subscriptionsTable.ownerVidyaId, selfId(req)),
          eq(subscriptionsTable.status, "Pending"),
          like(subscriptionsTable.providerPlanId, `${DEMO_PLAN_PREFIX.replace("_", "\\_")}%`),
        ),
      )
      .returning({ id: subscriptionsTable.id });

    if (!updated.length) {
      res.status(404).json({ error: "No pending demo subscription found." });
      return;
    }
    res.json({ ok: true, status: "Success", expiresAt: expiresAt.toISOString() });
  },
);

// Tutor links Razorpay Route account ID (acc_...)
router.patch(
  "/payments/:vidyaId/route-account",
  requireAuth,
  requireSelf,
  requireTutor,
  requirePlan("onlineFees"),
  async (req, res): Promise<void> => {
    const accountId = String(req.body?.accountId ?? "").trim();
    if (!/^acc_[A-Za-z0-9]+$/.test(accountId)) {
      res.status(400).json({ error: "Enter a valid Razorpay Route account ID (format: acc_...)." });
      return;
    }

    const updated = await db
      .update(usersTable)
      .set({ razorpayRouteAccountId: accountId })
      .where(and(eq(usersTable.vidyaId, selfId(req)), eq(usersTable.role, "tutor")))
      .returning({ accountId: usersTable.razorpayRouteAccountId });

    if (!updated.length) {
      res.status(403).json({ error: "Only tutors can connect a Route account." });
      return;
    }

    res.json({ ok: true, accountId: updated[0].accountId });
  },
);

// Parent retrieves tuition fees for linked children
router.get(
  "/payments/:vidyaId/parent-fees",
  requireAuth,
  requireSelf,
  async (req, res): Promise<void> => {
    const [parent] = await db
      .select({ role: usersTable.role })
      .from(usersTable)
      .where(eq(usersTable.vidyaId, selfId(req)))
      .limit(1);

    if (parent?.role !== "parent") {
      res.status(403).json({ error: "This area is for parents only." });
      return;
    }

    const links = await db
      .select({ studentVidyaId: parentStudentLinksTable.studentVidyaId })
      .from(parentStudentLinksTable)
      .where(eq(parentStudentLinksTable.parentVidyaId, selfId(req)));

    const ids = links.map((l) => l.studentVidyaId);
    if (!ids.length) {
      res.json({ fees: [] });
      return;
    }

    const rows = await db
      .select({
        id: feePaymentsTable.id,
        tutorVidyaId: feePaymentsTable.tutorVidyaId,
        studentVidyaId: feePaymentsTable.studentVidyaId,
        amount: feePaymentsTable.amount,
        period: feePaymentsTable.period,
        note: feePaymentsTable.note,
        status: feePaymentsTable.status,
        tutorName: usersTable.name,
        routeAccountId: usersTable.razorpayRouteAccountId,
      })
      .from(feePaymentsTable)
      .innerJoin(usersTable, eq(usersTable.vidyaId, feePaymentsTable.tutorVidyaId))
      .where(
        and(
          inArray(feePaymentsTable.studentVidyaId, ids),
          inArray(feePaymentsTable.status, ["unpaid", "pending"]),
        ),
      )
      .orderBy(desc(feePaymentsTable.createdAt));

    // Also fetch student names
    const studentUsers = await db
      .select({ vidyaId: usersTable.vidyaId, name: usersTable.name })
      .from(usersTable)
      .where(inArray(usersTable.vidyaId, ids));

    const studentMap = new Map(studentUsers.map((s) => [s.vidyaId, s.name]));

    const tutorIds = [...new Set(rows.map((r) => r.tutorVidyaId))];
    const subscribedTutors = new Set<string>();
    await Promise.all(
      tutorIds.map(async (id) => {
        if ((await activePlan(id))?.planCode === "tutor_pro") subscribedTutors.add(id);
      }),
    );

    const fees = rows.map(({ routeAccountId, ...row }) => {
      const breakdown = calculateIndianProcessingFees(row.amount);
      return {
        ...row,
        studentName: studentMap.get(row.studentVidyaId) ?? row.studentVidyaId,
        onlinePaymentAvailable: !!routeAccountId && subscribedTutors.has(row.tutorVidyaId),
        currency: "INR",
        breakdown,
      };
    });

    res.json({ fees });
  },
);

// Parent initiates Razorpay order to pay tutor tuition fee
router.post(
  "/payments/:vidyaId/parent-fees/:feeId/order",
  requireAuth,
  requireSelf,
  async (req, res): Promise<void> => {
    const feeId = Number(String(req.params.feeId));
    if (!Number.isInteger(feeId)) {
      res.status(400).json({ error: "Invalid fee record." });
      return;
    }

    const [fee] = await db
      .select({
        id: feePaymentsTable.id,
        tutorVidyaId: feePaymentsTable.tutorVidyaId,
        studentVidyaId: feePaymentsTable.studentVidyaId,
        amount: feePaymentsTable.amount,
        status: feePaymentsTable.status,
        routeAccountId: usersTable.razorpayRouteAccountId,
      })
      .from(feePaymentsTable)
      .innerJoin(usersTable, eq(usersTable.vidyaId, feePaymentsTable.tutorVidyaId))
      .where(eq(feePaymentsTable.id, feeId))
      .limit(1);

    if (!fee || !["unpaid", "pending"].includes(fee.status)) {
      res.status(404).json({ error: "This fee is not available for payment." });
      return;
    }

    const [link] = await db
      .select({ id: parentStudentLinksTable.id })
      .from(parentStudentLinksTable)
      .where(
        and(
          eq(parentStudentLinksTable.parentVidyaId, selfId(req)),
          eq(parentStudentLinksTable.studentVidyaId, fee.studentVidyaId),
        ),
      )
      .limit(1);

    if (!link) {
      res.status(403).json({ error: "This fee is not for a child linked to your account." });
      return;
    }

    if (!fee.routeAccountId) {
      res.status(409).json({ error: "The tutor has not configured their Razorpay Route account." });
      return;
    }

    if ((await activePlan(fee.tutorVidyaId))?.planCode !== "tutor_pro") {
      res.status(409).json({ error: "This tutor has not enabled online fee collection." });
      return;
    }

    // Standard Indian processing variables: 2% platform fee + 18% GST on platform fee
    const feeBreakdown = calculateIndianProcessingFees(fee.amount);
    const receipt = `vg_fee_${fee.id}_${randomUUID().slice(0, 8)}`;

    const order = await razorpayRequest<{ id: string }>("/orders", {
      method: "POST",
      body: JSON.stringify({
        amount: feeBreakdown.amountPaise,
        currency: "INR",
        receipt,
        notes: {
          kind: "tutor_fee",
          feeId: String(fee.id),
          payerVidyaId: selfId(req),
          currency: "INR",
        },
        transfers: [
          {
            account: fee.routeAccountId,
            amount: feeBreakdown.transferAmountPaise,
            currency: "INR",
            on_hold: 0,
            notes: { feeId: String(fee.id), studentVidyaId: fee.studentVidyaId },
          },
        ],
      }),
    });

    await db.insert(paymentOrdersTable).values({
      kind: "tutor_fee",
      providerOrderId: order.id,
      payerVidyaId: selfId(req),
      tutorVidyaId: fee.tutorVidyaId,
      studentVidyaId: fee.studentVidyaId,
      feePaymentId: fee.id,
      amountPaise: feeBreakdown.amountPaise,
      currency: "INR",
      platformFeePaise: feeBreakdown.platformFeePaise,
      gstPaise: feeBreakdown.gstPaise,
      transferAmountPaise: feeBreakdown.transferAmountPaise,
      status: "Pending", // Status state: Pending
      receipt,
    });

    res.status(201).json({
      mode: paymentsMode(),
      keyId: razorpayKeyId(),
      orderId: order.id,
      amount: feeBreakdown.amountPaise,
      currency: "INR",
      receipt,
      description: `VidyaGanit tuition fee #${fee.id}`,
      breakdown: feeBreakdown,
    });
  },
);

// Verify checkout payment signature and mark success
router.post(
  "/payments/:vidyaId/orders/:orderId/verify",
  requireAuth,
  requireSelf,
  async (req, res): Promise<void> => {
    const paymentId = String(req.body?.razorpay_payment_id ?? "");
    const signature = String(req.body?.razorpay_signature ?? "");
    const orderId = String(req.params.orderId);

    if (!verifyCheckoutSignature(orderId, paymentId, signature)) {
      res.status(400).json({ error: "Payment signature verification failed." });
      return;
    }

    const [local] = await db
      .select()
      .from(paymentOrdersTable)
      .where(
        and(
          eq(paymentOrdersTable.providerOrderId, orderId),
          eq(paymentOrdersTable.payerVidyaId, selfId(req)),
        ),
      )
      .limit(1);

    if (!local) {
      res.status(404).json({ error: "Order not found." });
      return;
    }

    const payment = await razorpayRequest<{
      id: string;
      order_id: string;
      amount: number;
      status: string;
      method?: string;
    }>(`/payments/${encodeURIComponent(paymentId)}`);

    if (
      payment.status !== "captured" ||
      (payment.order_id && payment.order_id !== orderId) ||
      (payment.amount && payment.amount !== local.amountPaise)
    ) {
      res.status(409).json({ error: "Payment has not been captured or does not match this order." });
      return;
    }

    await settleOrder(local, payment.id, signature, ledgerMethod(payment.method));

    res.json({ ok: true, status: "Success" });
  },
);

// Demo mode only: pay a pending demo order without any money or signature.
router.post(
  "/payments/:vidyaId/orders/:orderId/demo-confirm",
  requireAuth,
  requireSelf,
  async (req, res): Promise<void> => {
    if (!isDemoMode()) {
      res.status(404).json({ error: "Demo payments are not enabled." });
      return;
    }
    const [local] = await db
      .select()
      .from(paymentOrdersTable)
      .where(
        and(
          eq(paymentOrdersTable.providerOrderId, String(req.params.orderId)),
          eq(paymentOrdersTable.payerVidyaId, selfId(req)),
          eq(paymentOrdersTable.status, "Pending"),
        ),
      )
      .limit(1);
    if (!local) {
      res.status(404).json({ error: "No pending order found." });
      return;
    }
    await settleOrder(local, `pay_demo_${randomBytes(6).toString("hex")}`, null, "other");
    res.json({ ok: true, status: "Success" });
  },
);

// Record payment failure
router.post(
  "/payments/:vidyaId/orders/:orderId/fail",
  requireAuth,
  requireSelf,
  async (req, res): Promise<void> => {
    const orderId = String(req.params.orderId);
    const errorMessage = String(req.body?.error ?? req.body?.errorMessage ?? "Payment cancelled or failed");

    await db
      .update(paymentOrdersTable)
      .set({
        status: "Failed", // Status state: Failed
        errorMessage,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(paymentOrdersTable.providerOrderId, orderId),
          eq(paymentOrdersTable.payerVidyaId, selfId(req)),
        ),
      );

    res.json({ ok: true, status: "Failed" });
  },
);

// Payments that are not configured fail closed with a clear 503, not a 500.
router.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
  if (err instanceof PaymentsUnavailableError) {
    res.status(503).json({ error: err.message, code: err.code });
    return;
  }
  next(err);
});

export default router;
