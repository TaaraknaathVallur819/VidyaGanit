import { Router, type IRouter } from "express";
import { randomUUID } from "node:crypto";
import { and, desc, eq, sql } from "drizzle-orm";
import { db, usersTable, mockExamsTable, type MockQuestion } from "@workspace/db";
import {
  StartMockExamParams,
  StartMockExamBody,
  StartMockExamResponse,
  SubmitMockExamParams,
  SubmitMockExamBody,
  SubmitMockExamResponse,
  GetMockExamHistoryParams,
  GetMockExamHistoryResponse,
} from "@workspace/api-zod";
import { requireAuth, requireSelf, requireStudent } from "../middlewares/auth";
import { rateLimit } from "../middlewares/rateLimit";
import { generateMockExam, topicLabel, POINTS_PER_CORRECT } from "../lib/assessment";

const router: IRouter = Router();

const DEFAULT_QUESTIONS = 10;
// Modest XP so a full paper is rewarding without dwarfing daily play.
const XP_PER_CORRECT = 5;

router.post(
  "/mock-exam/:vidyaId/start",
  requireAuth,
  requireSelf,
  requireStudent,
  rateLimit({ windowMs: 60_000, max: 6, keyPrefix: "mock-start-minute" }),
  async (req, res): Promise<void> => {
    const params = StartMockExamParams.safeParse(req.params);
    const body = StartMockExamBody.safeParse(req.body ?? {});
    if (!params.success || !body.success) {
      res.status(400).json({ error: "Invalid input" });
      return;
    }

    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.vidyaId, params.data.vidyaId));
    if (!user) {
      res.status(404).json({ error: "Student not found" });
      return;
    }

    const count = body.data.questionCount ?? DEFAULT_QUESTIONS;
    const questions = generateMockExam(user.studentClass ?? null, count);
    const topics = [...new Set(questions.map((q) => q.topic))];
    // Default ~1 minute per question if the client doesn't specify a limit.
    const durationSec = (body.data.durationMin ?? count) * 60;
    const examId = randomUUID();

    try {
      await db.insert(mockExamsTable).values({
        examId,
        studentVidyaId: params.data.vidyaId,
        topics,
        questions,
        totalQuestions: questions.length,
        durationSec,
        pointsPerCorrect: POINTS_PER_CORRECT,
        status: "pending",
      });
    } catch (err) {
      req.log.error({ err }, "failed to persist mock exam");
      res.status(500).json({ error: "Couldn't start the exam. Please try again." });
      return;
    }

    res.json(
      StartMockExamResponse.parse({
        examId,
        totalQuestions: questions.length,
        durationSec,
        topics,
        // Never leak the answer key — only prompts + options.
        questions: questions.map((q) => ({ prompt: q.prompt, options: q.options })),
      }),
    );
  },
);

router.post(
  "/mock-exam/:vidyaId/submit",
  requireAuth,
  requireSelf,
  requireStudent,
  async (req, res): Promise<void> => {
    const params = SubmitMockExamParams.safeParse(req.params);
    const body = SubmitMockExamBody.safeParse(req.body);
    if (!params.success || !body.success) {
      res.status(400).json({ error: "Invalid input" });
      return;
    }

    const vidyaId = params.data.vidyaId;
    const { examId, answers } = body.data;

    const [row] = await db
      .select()
      .from(mockExamsTable)
      .where(eq(mockExamsTable.examId, examId));
    if (!row || row.studentVidyaId !== vidyaId) {
      res.status(404).json({ error: "Exam not found." });
      return;
    }
    if (row.status === "completed") {
      res.status(409).json({ error: "This exam has already been submitted." });
      return;
    }

    const questions = row.questions as MockQuestion[];
    const review = questions.map((q, i) => {
      const chosenIndex = Number.isInteger(answers[i]) ? answers[i] : -1;
      return {
        prompt: q.prompt,
        options: q.options,
        answerIndex: q.answerIndex,
        chosenIndex,
        topic: q.topic,
      };
    });

    const correctCount = review.filter((r) => r.chosenIndex === r.answerIndex).length;
    const score = correctCount * row.pointsPerCorrect;
    const xpAwarded = correctCount * XP_PER_CORRECT;
    const timeTakenSec = body.data.timeTakenSec ?? null;

    // Award XP exactly once: only the pending→completed transition grants it.
    const finalised = await db.transaction(async (tx) => {
      const updated = await tx
        .update(mockExamsTable)
        .set({
          status: "completed",
          correctCount,
          score,
          submittedAnswers: review.map((r) => r.chosenIndex),
          timeTakenSec,
          completedAt: new Date(),
        })
        .where(and(eq(mockExamsTable.examId, examId), eq(mockExamsTable.status, "pending")))
        .returning({ id: mockExamsTable.id });
      if (updated.length === 0) return false;
      if (xpAwarded > 0) {
        await tx
          .update(usersTable)
          .set({
            xp: sql`${usersTable.xp} + ${xpAwarded}`,
            coins: sql`${usersTable.coins} + ${xpAwarded}`,
          })
          .where(eq(usersTable.vidyaId, vidyaId));
      }
      return true;
    });
    if (!finalised) {
      res.status(409).json({ error: "This exam has already been submitted." });
      return;
    }

    // Per-topic breakdown for the analysis screen.
    const breakdown = new Map<string, { topic: string; label: string; correct: number; total: number }>();
    for (const r of review) {
      const cur = breakdown.get(r.topic) ?? { topic: r.topic, label: topicLabel(r.topic), correct: 0, total: 0 };
      cur.total += 1;
      if (r.chosenIndex === r.answerIndex) cur.correct += 1;
      breakdown.set(r.topic, cur);
    }

    res.json(
      SubmitMockExamResponse.parse({
        examId,
        score,
        correctCount,
        totalQuestions: questions.length,
        durationSec: row.durationSec,
        timeTakenSec,
        xpAwarded,
        topicBreakdown: [...breakdown.values()],
        review,
      }),
    );
  },
);

router.get(
  "/mock-exam/:vidyaId/history",
  requireAuth,
  requireSelf,
  requireStudent,
  async (req, res): Promise<void> => {
    const params = GetMockExamHistoryParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const rows = await db
      .select()
      .from(mockExamsTable)
      .where(
        and(
          eq(mockExamsTable.studentVidyaId, params.data.vidyaId),
          eq(mockExamsTable.status, "completed"),
        ),
      )
      .orderBy(desc(mockExamsTable.completedAt));

    res.json(
      GetMockExamHistoryResponse.parse({
        exams: rows.map((r) => ({
          examId: r.examId,
          score: r.score ?? 0,
          correctCount: r.correctCount ?? 0,
          totalQuestions: r.totalQuestions,
          timeTakenSec: r.timeTakenSec ?? null,
          completedAt: (r.completedAt ?? r.createdAt).toISOString(),
          topics: r.topics,
        })),
      }),
    );
  },
);

export default router;
