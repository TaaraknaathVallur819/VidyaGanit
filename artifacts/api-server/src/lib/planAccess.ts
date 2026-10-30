import { and, desc, eq, gt, inArray, notInArray, notLike, sql } from "drizzle-orm";
import type { NextFunction, Request, Response } from "express";
import { db, parentStudentLinksTable, subscriptionsTable, usersTable } from "@workspace/db";
import {
  DEMO_PLAN_PREFIX,
  PAYMENT_CATALOG,
  PLACEHOLDER_PLAN_IDS,
  type PlanCode,
} from "./paymentCatalog";
import { isDemoMode, isMockMode } from "./razorpay";

/**
 * The only subscription status that grants access. It is the value the verify
 * route and the Razorpay webhook write once a payment has genuinely succeeded.
 */
export const ACTIVE_STATUSES = ["Success"];

/**
 * What each tier allows. Change a number here and it changes everywhere (API
 * checks, error messages and the numbers the UI shows come from this object).
 */
export const FREE_LIMITS = { parentChildren: 1, tutorStudents: 5, studentGamesPerDay: 5 } as const;
/** Family Plus ("up to 4 children"). Tutor Pro is unlimited. */
export const PAID_LIMITS = { parentChildren: 4 } as const;

/**
 * The caller's currently valid plan, or null. Fails closed: the row must be
 * marked successful AND have an end date that is still in the future, and rows
 * that carry a placeholder plan id (created without a real payment) never count.
 * Demo-mode rows only count while demo mode is on, so switching it off ends
 * every demo plan at once.
 */
export async function activePlan(vidyaId: string) {
  const conditions = [
    eq(subscriptionsTable.ownerVidyaId, vidyaId),
    inArray(subscriptionsTable.status, ACTIVE_STATUSES),
    gt(subscriptionsTable.currentEnd, new Date()),
  ];
  if (!isMockMode()) {
    conditions.push(notInArray(subscriptionsTable.providerPlanId, PLACEHOLDER_PLAN_IDS));
  }
  if (!isDemoMode()) {
    conditions.push(notLike(subscriptionsTable.providerPlanId, `${DEMO_PLAN_PREFIX.replace("_", "\\_")}%`));
  }
  const [row] = await db
    .select({ planCode: subscriptionsTable.planCode, currentEnd: subscriptionsTable.currentEnd })
    .from(subscriptionsTable)
    .where(and(...conditions))
    .orderBy(desc(subscriptionsTable.createdAt))
    .limit(1);
  return row ?? null;
}

/** The paid plan a student benefits from through a linked parent or tutor, if any. */
export async function studentPremiumSource(studentVidyaId: string) {
  const links = await db
    .select({ ownerVidyaId: parentStudentLinksTable.parentVidyaId, role: usersTable.role })
    .from(parentStudentLinksTable)
    .innerJoin(usersTable, eq(usersTable.vidyaId, parentStudentLinksTable.parentVidyaId))
    .where(eq(parentStudentLinksTable.studentVidyaId, studentVidyaId));
  for (const link of links) {
    const plan = await activePlan(link.ownerVidyaId);
    if (plan && ((link.role === "parent" && plan.planCode === "family_plus") ||
      (link.role === "tutor" && plan.planCode === "tutor_pro"))) return plan.planCode;
  }
  return null;
}

/** The plan that unlocks premium features for an account role. Students have none. */
export function planForRole(role: string | null | undefined): PlanCode | null {
  if (role === "parent") return "family_plus";
  if (role === "tutor") return "tutor_pro";
  return null;
}

/**
 * Every locked feature. The key is stable (the UI translates it); the labels are
 * the English wording used in API error messages, per role where it differs.
 */
export const FEATURES = {
  advisor: { parent: "Strategy AI", tutor: "The AI Coach" },
  digest: { parent: "Weekly learning insights" },
  worksheets: { parent: "Personalised worksheets", tutor: "Personalised worksheets" },
  reportCards: { parent: "Report cards", tutor: "Report cards" },
  heatmap: { tutor: "The class heatmap" },
  weakTopics: { tutor: "Worksheets targeted at your class's weak spots" },
  onlineFees: { tutor: "Online fee collection" },
  manyChildren: { parent: "Linking more children" },
  manyStudents: { tutor: "Linking more students" },
} as const;
export type FeatureKey = keyof typeof FEATURES;

export interface PlanDenial {
  status: 402 | 403 | 409;
  body: {
    error: string;
    code: "PLAN_REQUIRED" | "ROLE_NOT_ELIGIBLE" | "LIMIT_REACHED";
    plan?: PlanCode;
    feature?: string;
    featureKey?: string;
    /** Who has to act: students cannot buy a plan, a linked adult can. */
    audience?: "student";
  };
}

function labelFor(featureKey: FeatureKey, role: "parent" | "tutor"): string | null {
  const labels: Partial<Record<"parent" | "tutor", string>> = FEATURES[featureKey];
  return labels[role] ?? null;
}

/** Null when the account may use `featureKey`; otherwise the response to send. */
export async function planDenial(vidyaId: string, featureKey: FeatureKey): Promise<PlanDenial | null> {
  const [user] = await db
    .select({ role: usersTable.role })
    .from(usersTable)
    .where(eq(usersTable.vidyaId, vidyaId))
    .limit(1);
  const required = planForRole(user?.role);
  const label = required ? labelFor(featureKey, user!.role as "parent" | "tutor") : null;
  if (!required || !label) {
    return {
      status: 403,
      body: { error: "This feature is not available for your account type.", code: "ROLE_NOT_ELIGIBLE" },
    };
  }
  const plan = await activePlan(vidyaId);
  if (plan?.planCode === required) return null;
  return {
    status: 402,
    body: {
      error: `${label} is part of ${PAYMENT_CATALOG[required].name}. Upgrade to unlock it.`,
      code: "PLAN_REQUIRED",
      plan: required,
      feature: label,
      featureKey,
    },
  };
}

/**
 * Locks a route behind the paid plan for the caller's role (parents need Family
 * Plus, tutors need Tutor Pro). Must run after `requireAuth`.
 */
export function requirePlan(featureKey: FeatureKey) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const vidyaId = req.vidyaId;
    if (!vidyaId) {
      res.status(401).json({ error: "Please log in to continue." });
      return;
    }
    const denial = await planDenial(vidyaId, featureKey);
    if (denial) {
      res.status(denial.status).json(denial.body);
      return;
    }
    next();
  };
}

/**
 * How many linked children (parents) or students (tutors) an account may have.
 * Parents get FREE_LIMITS.parentChildren, or PAID_LIMITS.parentChildren with
 * Family Plus; tutors get FREE_LIMITS.tutorStudents, or no limit with Tutor Pro.
 * Links that already exist are never removed, so a lapsed plan only stops *new*
 * links.
 */
export async function childLinkDenial(
  ownerVidyaId: string,
  newLinks: number,
): Promise<PlanDenial | null> {
  if (newLinks <= 0) return null;
  const [user] = await db
    .select({ role: usersTable.role })
    .from(usersTable)
    .where(eq(usersTable.vidyaId, ownerVidyaId))
    .limit(1);
  const role = user?.role;
  if (role !== "parent" && role !== "tutor") return null;

  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(parentStudentLinksTable)
    .where(eq(parentStudentLinksTable.parentVidyaId, ownerVidyaId));
  const wanted = (row?.count ?? 0) + newLinks;

  const freeCap = role === "parent" ? FREE_LIMITS.parentChildren : FREE_LIMITS.tutorStudents;
  if (wanted <= freeCap) return null;

  const required = planForRole(role)!;
  const featureKey: FeatureKey = role === "parent" ? "manyChildren" : "manyStudents";
  const noun = role === "parent" ? (freeCap === 1 ? "child" : "children") : "students";
  if ((await activePlan(ownerVidyaId))?.planCode !== required) {
    return {
      status: 402,
      body: {
        error: `Linking more than ${freeCap} ${noun} is part of ${PAYMENT_CATALOG[required].name}. Upgrade to unlock it.`,
        code: "PLAN_REQUIRED",
        plan: required,
        feature: `Linking more than ${freeCap} ${noun}`,
        featureKey,
      },
    };
  }
  if (role === "parent" && wanted > PAID_LIMITS.parentChildren) {
    return {
      status: 409,
      body: {
        error: `Family Plus covers up to ${PAID_LIMITS.parentChildren} children.`,
        code: "LIMIT_REACHED",
        featureKey,
      },
    };
  }
  return null;
}
