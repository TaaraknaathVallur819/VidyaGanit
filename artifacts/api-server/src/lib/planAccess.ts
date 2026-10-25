import { and, desc, eq, gt, inArray } from "drizzle-orm";
import { db, parentStudentLinksTable, subscriptionsTable, usersTable } from "@workspace/db";

const ACTIVE = ["active", "authenticated"];

export async function activePlan(vidyaId: string) {
  const rows = await db
    .select({ planCode: subscriptionsTable.planCode, currentEnd: subscriptionsTable.currentEnd })
    .from(subscriptionsTable)
    .where(
      and(
        eq(subscriptionsTable.ownerVidyaId, vidyaId),
        inArray(subscriptionsTable.status, ACTIVE),
      ),
    )
    .orderBy(desc(subscriptionsTable.createdAt));
  return rows.find((r) => !r.currentEnd || r.currentEnd > new Date()) ?? null;
}

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
