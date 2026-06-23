import { Router, type IRouter } from "express";
import {
  GetWorksheetParams,
  GetWorksheetBody,
  GetWorksheetResponse,
} from "@workspace/api-zod";
import {
  requireAuth,
  requireSelf,
  requireParentOrTutor,
} from "../middlewares/auth";
import { generateAssessment, topicLabel } from "../lib/assessment";

const router: IRouter = Router();

const MAX_QUESTIONS = 20;

// Generate a printable worksheet WITH its answer key. This is gated to
// parents/tutors only: the answer key must never be reachable by a student,
// who would otherwise get the answers to their own practice questions.
router.post(
  "/worksheet/:vidyaId",
  requireAuth,
  requireSelf,
  requireParentOrTutor,
  async (req, res): Promise<void> => {
    const params = GetWorksheetParams.safeParse(req.params);
    const body = GetWorksheetBody.safeParse(req.body);
    if (!params.success || !body.success) {
      res.status(400).json({ error: "Invalid request" });
      return;
    }
    const klass = body.data.klass ?? null;
    const want = Math.min(MAX_QUESTIONS, Math.max(1, body.data.count ?? 10));
    // generateAssessment returns a fixed-size batch; pull batches and dedupe by
    // prompt until we have enough distinct questions for the requested count.
    const seen = new Set<string>();
    const questions: { prompt: string; options: string[]; answer: number }[] =
      [];
    let guard = 0;
    while (questions.length < want && guard < 20) {
      guard++;
      for (const q of generateAssessment(body.data.topic, klass)) {
        if (questions.length >= want) break;
        if (seen.has(q.prompt)) continue;
        seen.add(q.prompt);
        questions.push({
          prompt: q.prompt,
          options: q.options,
          answer: q.answerIndex,
        });
      }
    }
    res.json(
      GetWorksheetResponse.parse({
        topic: body.data.topic,
        topicLabel: topicLabel(body.data.topic),
        klass,
        questions,
      }),
    );
  },
);

export default router;
