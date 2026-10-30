import { useEffect, useState } from "react";

export type PlanRole = "parent" | "tutor";
export type PaymentMode = "live" | "demo" | "mock" | "off";

export interface PlanStatus {
  /** The signed-in account's role, as the server knows it. */
  role: string | null;
  /** The caller's current paid plan, or null when they are on the free tier. */
  plan: { code: string; currentEnd: string | null } | null;
  /** False until Razorpay (or the demo checkout) has been switched on on the server. */
  paymentsEnabled: boolean;
  mode: PaymentMode;
  /** Where plan holders write for priority support, when the owner has set one. */
  supportEmail: string | null;
}

export const PLAN_FOR_ROLE: Record<PlanRole, { code: string; name: string; fromPrice: number }> = {
  parent: { code: "family_plus", name: "Family Plus", fromPrice: 249 },
  tutor: { code: "tutor_pro", name: "Tutor Pro", fromPrice: 599 },
};

/** Translation key for a locked feature, from the API's stable feature key. */
export function featureNameKey(featureKey: string | undefined, planCode: string | undefined): string | null {
  switch (featureKey) {
    case "advisor":
      return planCode === "tutor_pro" ? "feature.aiCoach" : "feature.strategyAi";
    case "digest":
      return "feature.weeklyInsights";
    case "worksheets":
      return "feature.worksheets";
    case "reportCards":
      return "feature.reportCards";
    case "heatmap":
      return "feature.classHeatmap";
    case "weakTopics":
      return "feature.weakTopics";
    case "onlineFees":
      return "feature.onlineFees";
    case "manyChildren":
      return "feature.manyChildren";
    case "manyStudents":
      return "feature.manyStudents";
    default:
      return null;
  }
}

const CHANGED_EVENT = "vg:plan-changed";
const cache = new Map<string, Promise<PlanStatus | null>>();

async function fetchPlanStatus(vidyaId: string): Promise<PlanStatus | null> {
  try {
    const res = await fetch(`/api/payments/${encodeURIComponent(vidyaId)}/status`, {
      credentials: "same-origin",
    });
    if (!res.ok) return null;
    const data = await res.json();
    return {
      role: data.role ?? null,
      plan: data.plan ?? null,
      paymentsEnabled: data.paymentsEnabled !== false,
      mode: (data.mode as PaymentMode) ?? "off",
      supportEmail: data.supportEmail ?? null,
    };
  } catch {
    return null;
  }
}

/** Forget the cached plan and tell every gate to re-check (call after a purchase). */
export function refreshPlanStatus(): void {
  cache.clear();
  if (typeof window !== "undefined") window.dispatchEvent(new Event(CHANGED_EVENT));
}

/**
 * The signed-in user's plan. `undefined` while loading, `null` if it could not
 * be read. The UI treats `null` as "don't block": the server is what actually
 * enforces the lock, so a failed lookup must never lock out a paying customer.
 */
export function usePlanStatus(vidyaId: string): PlanStatus | null | undefined {
  const [status, setStatus] = useState<PlanStatus | null | undefined>(undefined);

  useEffect(() => {
    if (!vidyaId) return;
    let alive = true;
    const load = () => {
      let pending = cache.get(vidyaId);
      if (!pending) {
        pending = fetchPlanStatus(vidyaId);
        cache.set(vidyaId, pending);
      }
      void pending.then((s) => {
        if (alive) setStatus(s);
      });
    };
    load();
    window.addEventListener(CHANGED_EVENT, load);
    return () => {
      alive = false;
      window.removeEventListener(CHANGED_EVENT, load);
    };
  }, [vidyaId]);

  return status;
}

export function hasPlanFor(status: PlanStatus | null | undefined, role: PlanRole): boolean {
  return status?.plan?.code === PLAN_FOR_ROLE[role].code;
}
