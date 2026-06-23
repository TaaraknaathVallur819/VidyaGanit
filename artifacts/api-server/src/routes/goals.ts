import { Router, type IRouter } from "express";
import { and, eq } from "drizzle-orm";
import { db, usersTable, weeklyGoalsTable } from "@workspace/db";
import {
  GetWeeklygoalParams,
  GetWeeklygoalResponse,
  SetWeeklyGoalParams,
  SetWeeklyGoalBody,
  SetWeeklyGoalResponse,
  GetStudentWeeklyGoalParams,
  GetStudentWeeklyGoalResponse,
} from "@workspace/api-zod";
import {
  requireAuth,
  requireSelf,
  requireParentOrTutor,
} from "../middlewares/auth";
import { istToday, shiftDate } from "../lib/streak";
import { getLinkedStudentFor } from "../lib/links";

const router: IRouter = Router();

/** The Monday (IST) of the week containing `today`, as a YYYY-MM-DD string. */
export function istWeekStart(today: string = istToday()): string {
  const [y, m, d] = today.split("-").map(Number);
  const day = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0=Sun..6=Sat
  const delta = day === 0 ? -6 : 1 - day;
  return shiftDate(today, delta);
}

/**
 * Build the weekly-goal payload for a student. Progress is derived from the
 * `startXp` snapshot taken when the week's goal was set, so no XP ledger is
 * needed: earnedXp = current xp - startXp (clamped >= 0).
 */
async function goalPayload(vidyaId: string) {
  const weekStart = istWeekStart();
  const [user] = await db
    .select({ xp: usersTable.xp })
    .from(usersTable)
    .where(eq(usersTable.vidyaId, vidyaId));
  const xp = user?.xp ?? 0;
  const [goal] = await db
    .select()
    .from(weeklyGoalsTable)
    .where(
      and(
        eq(weeklyGoalsTable.vidyaId, vidyaId),
        eq(weeklyGoalsTable.weekStart, weekStart),
      ),
    );
  if (!goal) {
    return { weekStart, targetXp: 0, earnedXp: 0, percent: 0 };
  }
  const earnedXp = Math.max(0, xp - goal.startXp);
  const percent =
    goal.targetXp > 0
      ? Math.min(100, Math.round((earnedXp / goal.targetXp) * 100))
      : 0;
  return { weekStart, targetXp: goal.targetXp, earnedXp, percent };
}

// ── Student's own weekly goal ───────────────────────────────────────
router.get(
  "/goals/:vidyaId",
  requireAuth,
  requireSelf,
  async (req, res): Promise<void> => {
    const params = GetWeeklygoalParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    res.json(GetWeeklygoalResponse.parse(await goalPayload(params.data.vidyaId)));
  },
);

router.put(
  "/goals/:vidyaId",
  requireAuth,
  requireSelf,
  async (req, res): Promise<void> => {
    const params = SetWeeklyGoalParams.safeParse(req.params);
    const body = SetWeeklyGoalBody.safeParse(req.body);
    if (!params.success || !body.success) {
      res.status(400).json({ error: "Invalid target" });
      return;
    }
    const weekStart = istWeekStart();
    const [user] = await db
      .select({ xp: usersTable.xp })
      .from(usersTable)
      .where(eq(usersTable.vidyaId, params.data.vidyaId));
    if (!user) {
      res.status(404).json({ error: "Student not found" });
      return;
    }
    // First set this week snapshots startXp; later edits only change the target
    // so progress already earned this week is preserved.
    await db
      .insert(weeklyGoalsTable)
      .values({
        vidyaId: params.data.vidyaId,
        weekStart,
        targetXp: body.data.targetXp,
        startXp: user.xp ?? 0,
      })
      .onConflictDoUpdate({
        target: [weeklyGoalsTable.vidyaId, weeklyGoalsTable.weekStart],
        set: { targetXp: body.data.targetXp },
      });
    res.json(SetWeeklyGoalResponse.parse(await goalPayload(params.data.vidyaId)));
  },
);

// ── A linked student's weekly goal (parent/tutor) ───────────────────
router.get(
  "/parent/:vidyaId/students/:studentVidyaId/goal",
  requireAuth,
  requireSelf,
  requireParentOrTutor,
  async (req, res): Promise<void> => {
    const params = GetStudentWeeklyGoalParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const student = await getLinkedStudentFor(
      params.data.vidyaId,
      params.data.studentVidyaId,
    );
    if (!student) {
      res.status(403).json({ error: "Student not linked to this account." });
      return;
    }
    res.json(
      GetStudentWeeklyGoalResponse.parse(
        await goalPayload(params.data.studentVidyaId),
      ),
    );
  },
);

export default router;
