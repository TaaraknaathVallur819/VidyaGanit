export const PAYMENT_CATALOG = {
  family_plus: {
    name: "Family Plus",
    role: "parent",
    prices: { monthly: 24_900, yearly: 249_900 },
    features: [
      "Strategy AI and weekly learning insights",
      "Personalised worksheets and report cards",
      "Link and monitor multiple children",
      "Higher AI learning limits for linked children",
    ],
  },
  tutor_pro: {
    name: "Tutor Pro",
    role: "tutor",
    prices: { monthly: 59_900, yearly: 599_900 },
    features: [
      "AI Coach, class heatmap and advanced reports",
      "Personalised worksheet generation",
      "Razorpay online fee collection",
      "Higher limits for students and classes",
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

export function providerPlanId(plan: PlanCode, cycle: BillingCycle): string {
  const key = `RAZORPAY_PLAN_${plan.toUpperCase()}_${cycle.toUpperCase()}`;
  return process.env[key] || `plan_${plan}_${cycle}`;
}
