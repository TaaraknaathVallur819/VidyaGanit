import { PaymentsUnavailableError, isDemoMode, isMockMode } from "./razorpay";

/** Plan ids of demo-mode subscriptions. They only count while demo mode is on. */
export const DEMO_PLAN_PREFIX = "demo_";

export const PAYMENT_CATALOG = {
  family_plus: {
    name: "Family Plus",
    role: "parent",
    prices: { monthly: 24_900, yearly: 249_900 },
    features: [
      "Strategy AI and weekly learning insights",
      "Personalised worksheets and report cards you can share on WhatsApp",
      "Link up to 4 children",
      "Unlimited games for every linked child",
    ],
  },
  tutor_pro: {
    name: "Tutor Pro",
    role: "tutor",
    prices: { monthly: 59_900, yearly: 599_900 },
    features: [
      "AI Coach and class heatmap",
      "Worksheets targeted at your class's weak spots",
      "WhatsApp-ready progress cards",
      "Unlimited students (free plan: up to 5)",
      "Online fee collection through Razorpay",
      "Priority support by email",
    ],
  },
} as const;

export type PlanCode = keyof typeof PAYMENT_CATALOG;
export type BillingCycle = "monthly" | "yearly";

export function publicCatalog() {
  return Object.entries(PAYMENT_CATALOG).map(([code, plan]) => ({
    code,
    name: plan.name,
    role: plan.role,
    prices: plan.prices,
    features: plan.features,
    currency: "INR",
  }));
}

function placeholderPlanId(plan: PlanCode, cycle: BillingCycle): string {
  return `plan_${plan}_${cycle}`;
}

/**
 * Plan ids that builds before this one invented when no Razorpay plan was
 * configured. They never exist at Razorpay, so a subscription carrying one was
 * created without a real payment and must never grant access.
 */
export const PLACEHOLDER_PLAN_IDS: string[] = (Object.keys(PAYMENT_CATALOG) as PlanCode[]).flatMap(
  (plan) => (["monthly", "yearly"] as const).map((cycle) => placeholderPlanId(plan, cycle)),
);

/**
 * The Razorpay plan id for a plan + billing cycle. It comes from
 * RAZORPAY_PLAN_<PLAN>_<CYCLE> (e.g. RAZORPAY_PLAN_FAMILY_PLUS_MONTHLY); when
 * that is missing the plan cannot be sold, except in explicit mock mode.
 */
export function providerPlanId(plan: PlanCode, cycle: BillingCycle): string {
  const key = `RAZORPAY_PLAN_${plan.toUpperCase()}_${cycle.toUpperCase()}`;
  const configured = process.env[key]?.trim();
  if (isDemoMode()) return `${DEMO_PLAN_PREFIX}${plan}_${cycle}`;
  if (configured) return configured;
  if (isMockMode()) return placeholderPlanId(plan, cycle);
  throw new PaymentsUnavailableError("This plan is not available for purchase yet.");
}
