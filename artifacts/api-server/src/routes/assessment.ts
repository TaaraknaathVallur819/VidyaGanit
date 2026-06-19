import { Router, type IRouter } from "express";
import { randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { db, usersTable, assessmentsTable, type AssessmentQuestion } from "@workspace/db";
import {
  GenerateAssessmentBody,
  GenerateAssessmentResponse,
  SubmitAssessmentBody,
  SubmitAssessmentResponse,
  ListOwnAssessmentsParams,
  ListOwnAssessmentsResponse,
  GetOwnMistakesParams,
  GetOwnMistakesResponse,
} from "@workspace/api-zod";
import { requireAuth, requireSelf } from "../middlewares/auth";
import { rateLimit } from "../middlewares/rateLimit";
import {
  generateAssessment,
  topicLabel,
  collectMistakes,
  POINTS_PER_CORRECT,
} from "../lib/assessment";

const router: IRouter = Router();

// ── Generate a fresh topic-mastery test ─────────────────────────────
router.post(
  "/assessment/generate",
  requireAuth,
  rateLimit({ windowMs: 60_000, max: 10, keyPrefix: "assess-gen-minute" }),
  rateLimit({
    windowMs: 60 * 60_000,
    max: 60,
    keyPrefix: "assess-gen-hour",
    message: "That's a lot of tests! 🌟 Take a little break and come back soon.",
  }),
  async (req, res): Promise<void> => {
    const parsed = GenerateAssessmentBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const vidyaId = req.vidyaId as string;
    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.vidyaId, vidyaId));
    if (!user) {
      res.status(404).json({ error: "Student not found" });
      return;
    }

    const topic = parsed.data.topic.trim().slice(0, 40) || "general";
    const label = topicLabel(topic);
    const questions = generateAssessment(topic, user.studentClass ?? null);
    const testId = randomUUID();

    try {
      await db.insert(assessmentsTable).values({
        testId,
        studentVidyaId: vidyaId,
        topic,
        topicLabel: label,
        questions,
        pointsPerCorrect: POINTS_PER_CORRECT,
        totalQuestions: questions.length,
        status: "pending",
      });
    } catch (err) {
      req.log.error({ err }, "failed to persist generated assessment");
      res.status(500).json({ error: "Couldn't start the test. Please try again." });
      return;
    }

    // Never leak the answer key to the client — only prompts + options.
    res.json(
      GenerateAssessmentResponse.parse({
        testId,
        topic,
        topicLabel: label,
        pointsPerCorrect: POINTS_PER_CORRECT,
        totalQuestions: questions.length,
        questions: questions.map((q) => ({ prompt: q.prompt, options: q.options })),
      }),
    );
  },
);

// ── Submit answers and get the graded result ────────────────────────
router.post(
  "/assessment/submit",
  requireAuth,
  rateLimit({ windowMs: 60_000, max: 20, keyPrefix: "assess-submit-minute" }),
  async (req, res): Promise<void> => {
    const parsed = SubmitAssessmentBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const vidyaId = req.vidyaId as string;
    const { testId, answers } = parsed.data;

    const [row] = await db
      .select()
      .from(assessmentsTable)
      .where(eq(assessmentsTable.testId, testId));

    if (!row || row.studentVidyaId !== vidyaId) {
      res.status(404).json({ error: "Test not found." });
      return;
    }
    if (row.status === "completed") {
      res.status(409).json({ error: "This test has already been submitted." });
      return;
    }

    const questions = row.questions as AssessmentQuestion[];
    const review = questions.map((q, i) => {
      const chosenIndex = Number.isInteger(answers[i]) ? answers[i] : -1;
      const correct = chosenIndex === q.answerIndex;
      return {
        prompt: q.prompt,
        options: q.options,
        answerIndex: q.answerIndex,
        chosenIndex,
        correct,
      };
    });

    const correctCount = review.filter((r) => r.correct).length;
    // No negative marking — score is simply correct answers × points.
    const score = correctCount * row.pointsPerCorrect;
    const maxScore = questions.length * row.pointsPerCorrect;

    try {
      await db
        .update(assessmentsTable)
        .set({
          status: "completed",
          correctCount,
          score,
          submittedAnswers: review.map((r) => r.chosenIndex),
          completedAt: new Date(),
        })
        .where(eq(assessmentsTable.testId, testId));
    } catch (err) {
      req.log.error({ err }, "failed to finalise assessment");
      res.status(500).json({ error: "Couldn't save your result. Please try again." });
      return;
    }

    res.json(
      SubmitAssessmentResponse.parse({
        testId,
        topic: row.topic,
        topicLabel: row.topicLabel,
        totalQuestions: questions.length,
        correctCount,
        incorrectCount: questions.length - correctCount,
        pointsPerCorrect: row.pointsPerCorrect,
        score,
        maxScore,
        review,
      }),
    );
  },
);

// ── A student's own completed results ───────────────────────────────
router.get(
  "/assessment/:vidyaId/results",
  requireAuth,
  requireSelf,
  async (req, res): Promise<void> => {
    const params = ListOwnAssessmentsParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const rows = await db
      .select()
      .from(assessmentsTable)
      .where(
        and(
          eq(assessmentsTable.studentVidyaId, params.data.vidyaId),
          eq(assessmentsTable.status, "completed"),
        ),
      )
      .orderBy(desc(assessmentsTable.completedAt));

    res.json(
      ListOwnAssessmentsResponse.parse({
        results: rows.map((r) => ({
          testId: r.testId,
          topic: r.topic,
          topicLabel: r.topicLabel,
          totalQuestions: r.totalQuestions,
          correctCount: r.correctCount ?? 0,
          score: r.score ?? 0,
          maxScore: r.totalQuestions * r.pointsPerCorrect,
          completedAt: (r.completedAt ?? r.createdAt).toISOString(),
        })),
      }),
    );
  },
);

// ── A student's own missed questions (Mistake Notebook) ─────────────
router.get(
  "/assessment/:vidyaId/mistakes",
  requireAuth,
  requireSelf,
  async (req, res): Promise<void> => {
    const params = GetOwnMistakesParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const rows = await db
      .select()
      .from(assessmentsTable)
      .where(
        and(
          eq(assessmentsTable.studentVidyaId, params.data.vidyaId),
          eq(assessmentsTable.status, "completed"),
        ),
      )
      .orderBy(desc(assessmentsTable.completedAt));

    const mistakes = collectMistakes(
      rows.map((r) => ({
        testId: r.testId,
        topic: r.topic,
        topicLabel: r.topicLabel,
        completedAt: (r.completedAt ?? r.createdAt).toISOString(),
        questions: r.questions as AssessmentQuestion[],
        submittedAnswers: r.submittedAnswers as number[] | null,
      })),
    );

    res.json(GetOwnMistakesResponse.parse({ mistakes }));
  },
);

export default router;
