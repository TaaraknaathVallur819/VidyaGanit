import { Router, type IRouter } from "express";
import { and, desc, eq } from "drizzle-orm";
import { db, usersTable, assessmentsTable } from "@workspace/db";
import { GetReportCardParams, GetReportCardResponse } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";
import { getLinkedStudentFor } from "../lib/links";
import { topicLabel } from "../lib/assessment";

const router: IRouter = Router();

/**
 * An assembled progress report card for a student. Readable by the student
 * themselves OR by a parent/tutor linked to them (so it can't use `requireSelf`).
 * Derived on read from completed assessments — there is no report-card table.
 */
router.get(
  "/report-card/:vidyaId",
  requireAuth,
  async (req, res): Promise<void> => {
    const params = GetReportCardParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const requester = req.vidyaId as string;
    const studentId = params.data.vidyaId;

    if (requester !== studentId) {
      const linked = await getLinkedStudentFor(requester, studentId);
      if (!linked) {
        res.status(403).json({ error: "You can only view your own report card." });
        return;
      }
    }

    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.vidyaId, studentId));
    if (!user) {
      res.status(403).json({ error: "Student not found." });
      return;
    }

    const rows = await db
      .select()
      .from(assessmentsTable)
      .where(
        and(
          eq(assessmentsTable.studentVidyaId, studentId),
          eq(assessmentsTable.status, "completed"),
        ),
      )
      .orderBy(desc(assessmentsTable.completedAt));

    const tests = rows.map((r) => {
      const total = r.totalQuestions || 1;
      const correct = r.correctCount ?? 0;
      const scorePct = Math.round((correct / total) * 100);
      return {
        topic: r.topic,
        topicLabel: r.topicLabel,
        totalQuestions: r.totalQuestions,
        correctCount: correct,
        scorePct,
        completedAt: (r.completedAt ?? r.createdAt).toISOString(),
      };
    });

    // Per-topic aggregation.
    const byTopic = new Map<
      string,
      { topic: string; label: string; attempts: number; sumPct: number; bestPct: number }
    >();
    for (const t of tests) {
      const cur =
        byTopic.get(t.topic) ??
        { topic: t.topic, label: topicLabel(t.topic), attempts: 0, sumPct: 0, bestPct: 0 };
      cur.attempts += 1;
      cur.sumPct += t.scorePct;
      cur.bestPct = Math.max(cur.bestPct, t.scorePct);
      byTopic.set(t.topic, cur);
    }
    const topics = [...byTopic.values()]
      .map((c) => ({
        topic: c.topic,
        label: c.label,
        attempts: c.attempts,
        avgScorePct: Math.round(c.sumPct / c.attempts),
        bestScorePct: c.bestPct,
      }))
      .sort((a, b) => b.attempts - a.attempts);

    const averageScorePct =
      tests.length === 0
        ? 0
        : Math.round(tests.reduce((s, t) => s + t.scorePct, 0) / tests.length);

    res.json(
      GetReportCardResponse.parse({
        student: {
          vidyaId: user.vidyaId,
          name: user.name,
          studentClass: user.studentClass ?? null,
          board: user.board ?? null,
          batch: user.batch ?? null,
        },
        xp: user.xp,
        coins: user.coins,
        streakCurrent: user.streakCurrent,
        streakLongest: user.streakLongest,
        badges: user.badges ?? [],
        totalTests: tests.length,
        averageScorePct,
        topics,
        recentTests: tests.slice(0, 8).map((t) => ({
          topicLabel: t.topicLabel,
          scorePct: t.scorePct,
          totalQuestions: t.totalQuestions,
          correctCount: t.correctCount,
          completedAt: t.completedAt,
        })),
        generatedAt: new Date().toISOString(),
      }),
    );
  },
);

export default router;
