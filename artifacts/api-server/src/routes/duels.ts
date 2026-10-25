import { Router, type IRouter } from "express";
import { randomUUID } from "node:crypto";
import { and, desc, eq, inArray, isNull, ne, or, sql } from "drizzle-orm";
import { db, usersTable, duelsTable, type AssessmentQuestion } from "@workspace/db";
import {
  GetDuelsParams,
  GetDuelsResponse,
  CreateDuelParams,
  CreateDuelBody,
  CreateDuelResponse,
  GetDuelQuestionsParams,
  GetDuelQuestionsResponse,
  SubmitDuelParams,
  SubmitDuelBody,
  SubmitDuelResponse,
} from "@workspace/api-zod";
import { requireAuth, requireSelf, requireStudent } from "../middlewares/auth";
import { rateLimit } from "../middlewares/rateLimit";
import { generateAssessment } from "../lib/assessment";
import { createNotification } from "../lib/notify";

const router: IRouter = Router();

const PARTICIPATION_XP = 10;
const WIN_BONUS_XP = 10;
const TIE_BONUS_XP = 5;

/** Classmates in the same batch a student can duel (students only, not self). */
async function classmates(vidyaId: string, batch: string | null) {
  if (!batch) return [] as { vidyaId: string; name: string }[];
  return db
    .select({ vidyaId: usersTable.vidyaId, name: usersTable.name })
    .from(usersTable)
    .where(
      and(
        eq(usersTable.role, "student"),
        eq(usersTable.batch, batch),
        ne(usersTable.vidyaId, vidyaId),
      ),
    );
}

type DuelRow = typeof duelsTable.$inferSelect;

function gradeAnswers(questions: AssessmentQuestion[], answers: number[]): number {
  let correct = 0;
  questions.forEach((q, i) => {
    if (Number.isInteger(answers[i]) && answers[i] === q.answerIndex) correct += 1;
  });
  return correct;
}

function summarise(row: DuelRow, me: string, names: Map<string, string>) {
  const isChallenger = row.challengerVidyaId === me;
  const youSubmitted = isChallenger ? row.challengerAnswers != null : row.opponentAnswers != null;
  const theySubmitted = isChallenger ? row.opponentAnswers != null : row.challengerAnswers != null;
  const yourScore = isChallenger ? row.challengerScore : row.opponentScore;
  const theirScore = isChallenger ? row.opponentScore : row.challengerScore;
  let winner: "you" | "them" | "tie" | null = null;
  if (row.status === "completed" && yourScore != null && theirScore != null) {
    winner = yourScore > theirScore ? "you" : yourScore < theirScore ? "them" : "tie";
  }
  return {
    duelId: row.duelId,
    role: (isChallenger ? "challenger" : "opponent") as "challenger" | "opponent",
    challengerName: names.get(row.challengerVidyaId) ?? row.challengerVidyaId,
    opponentName: names.get(row.opponentVidyaId) ?? row.opponentVidyaId,
    status: row.status as "pending" | "completed",
    youSubmitted,
    theySubmitted,
    yourScore: yourScore ?? null,
    theirScore: theirScore ?? null,
    winner,
    totalQuestions: (row.questions as AssessmentQuestion[]).length,
    createdAt: row.createdAt.toISOString(),
  };
}

router.get(
  "/duels/:vidyaId",
  requireAuth,
  requireSelf,
  requireStudent,
  async (req, res): Promise<void> => {
    const params = GetDuelsParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const me = params.data.vidyaId;
    const [user] = await db.select().from(usersTable).where(eq(usersTable.vidyaId, me));
    if (!user) {
      res.status(404).json({ error: "Student not found" });
      return;
    }

    const opponents = await classmates(me, user.batch ?? null);

    const rows = await db
      .select()
      .from(duelsTable)
      .where(or(eq(duelsTable.challengerVidyaId, me), eq(duelsTable.opponentVidyaId, me)))
      .orderBy(desc(duelsTable.createdAt));

    const ids = new Set<string>();
    for (const r of rows) {
      ids.add(r.challengerVidyaId);
      ids.add(r.opponentVidyaId);
    }
    const nameRows = ids.size
      ? await db
          .select({ vidyaId: usersTable.vidyaId, name: usersTable.name })
          .from(usersTable)
          .where(inArray(usersTable.vidyaId, [...ids]))
      : [];
    const names = new Map(nameRows.map((n) => [n.vidyaId, n.name]));

    const all = rows.map((r) => summarise(r, me, names));
    res.json(
      GetDuelsResponse.parse({
        opponents,
        incoming: all.filter((d) => d.status === "pending" && d.role === "opponent" && !d.youSubmitted),
        outgoing: all.filter((d) => d.status === "pending" && (d.role === "challenger" || d.youSubmitted)),
        completed: all.filter((d) => d.status === "completed"),
      }),
    );
  },
);

router.post(
  "/duels/:vidyaId/challenge",
  requireAuth,
  requireSelf,
  requireStudent,
  rateLimit({ windowMs: 60_000, max: 10, keyPrefix: "duel-challenge" }),
  async (req, res): Promise<void> => {
    const params = CreateDuelParams.safeParse(req.params);
    const body = CreateDuelBody.safeParse(req.body);
    if (!params.success || !body.success) {
      res.status(400).json({ error: "Invalid input" });
      return;
    }
    const me = params.data.vidyaId;
    if (body.data.opponentVidyaId === me) {
      res.status(400).json({ error: "You can't duel yourself." });
      return;
    }

    const [user] = await db.select().from(usersTable).where(eq(usersTable.vidyaId, me));
    const [opp] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.vidyaId, body.data.opponentVidyaId));
    if (!user || !opp) {
      res.status(404).json({ error: "Opponent not found" });
      return;
    }
    if (opp.role !== "student" || !user.batch || opp.batch !== user.batch) {
      res.status(404).json({ error: "You can only duel a classmate in your batch." });
      return;
    }

    const questions = generateAssessment("general", user.studentClass ?? null);
    const duelId = randomUUID();
    await db.insert(duelsTable).values({
      duelId,
      challengerVidyaId: me,
      opponentVidyaId: opp.vidyaId,
      batch: user.batch,
      questions,
    });

    await createNotification({
      recipientVidyaId: opp.vidyaId,
      type: "duel",
      title: `${user.name} challenged you to a Maths Duel! ⚔️`,
      body: "Tap to accept and play.",
      linkTab: "duels",
    });

    res.json(CreateDuelResponse.parse({ duelId }));
  },
);

router.get(
  "/duels/:vidyaId/:duelId",
  requireAuth,
  requireSelf,
  requireStudent,
  async (req, res): Promise<void> => {
    const params = GetDuelQuestionsParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const me = params.data.vidyaId;
    const [row] = await db
      .select()
      .from(duelsTable)
      .where(eq(duelsTable.duelId, params.data.duelId));
    if (!row || (row.challengerVidyaId !== me && row.opponentVidyaId !== me)) {
      res.status(404).json({ error: "Duel not found" });
      return;
    }
    const isChallenger = row.challengerVidyaId === me;
    const mine = isChallenger ? row.challengerAnswers : row.opponentAnswers;
    if (mine != null) {
      res.status(409).json({ error: "You have already played this duel." });
      return;
    }
    const questions = row.questions as AssessmentQuestion[];
    res.json(
      GetDuelQuestionsResponse.parse({
        duelId: row.duelId,
        totalQuestions: questions.length,
        questions: questions.map((q) => ({ prompt: q.prompt, options: q.options })),
      }),
    );
  },
);

router.post(
  "/duels/:vidyaId/:duelId/submit",
  requireAuth,
  requireSelf,
  requireStudent,
  async (req, res): Promise<void> => {
    const params = SubmitDuelParams.safeParse(req.params);
    const body = SubmitDuelBody.safeParse(req.body);
    if (!params.success || !body.success) {
      res.status(400).json({ error: "Invalid input" });
      return;
    }
    const me = params.data.vidyaId;
    const [row] = await db
      .select()
      .from(duelsTable)
      .where(eq(duelsTable.duelId, params.data.duelId));
    if (!row || (row.challengerVidyaId !== me && row.opponentVidyaId !== me)) {
      res.status(404).json({ error: "Duel not found" });
      return;
    }
    const isChallenger = row.challengerVidyaId === me;
    const mineExisting = isChallenger ? row.challengerAnswers : row.opponentAnswers;
    if (mineExisting != null) {
      res.status(409).json({ error: "You have already played this duel." });
      return;
    }

    const questions = row.questions as AssessmentQuestion[];
    const answers = body.data.answers;
    const myScore = gradeAnswers(questions, answers);

    // Record my answers + score (guarded so a double-submit can't double-award),
    // grant participation XP, and finalise + award a winner bonus once both have
    // played — all atomically.
    const outcome = await db.transaction(async (tx) => {
      const guard = isChallenger
        ? isNull(duelsTable.challengerAnswers)
        : isNull(duelsTable.opponentAnswers);
      const updated = await tx
        .update(duelsTable)
        .set(
          isChallenger
            ? { challengerAnswers: answers, challengerScore: myScore }
            : { opponentAnswers: answers, opponentScore: myScore },
        )
        .where(and(eq(duelsTable.duelId, row.duelId), guard))
        .returning();
      if (updated.length === 0) return null;

      await tx
        .update(usersTable)
        .set({
          xp: sql`${usersTable.xp} + ${PARTICIPATION_XP}`,
          coins: sql`${usersTable.coins} + ${PARTICIPATION_XP}`,
        })
        .where(eq(usersTable.vidyaId, me));

      const d = updated[0];
      if (d.challengerAnswers != null && d.opponentAnswers != null && d.status !== "completed") {
        await tx
          .update(duelsTable)
          .set({ status: "completed", completedAt: new Date() })
          .where(eq(duelsTable.duelId, d.duelId));
        const cs = d.challengerScore ?? 0;
        const os = d.opponentScore ?? 0;
        if (cs === os) {
          await tx
            .update(usersTable)
            .set({
              xp: sql`${usersTable.xp} + ${TIE_BONUS_XP}`,
              coins: sql`${usersTable.coins} + ${TIE_BONUS_XP}`,
            })
            .where(inArray(usersTable.vidyaId, [d.challengerVidyaId, d.opponentVidyaId]));
        } else {
          const winnerId = cs > os ? d.challengerVidyaId : d.opponentVidyaId;
          await tx
            .update(usersTable)
            .set({
              xp: sql`${usersTable.xp} + ${WIN_BONUS_XP}`,
              coins: sql`${usersTable.coins} + ${WIN_BONUS_XP}`,
            })
            .where(eq(usersTable.vidyaId, winnerId));
        }
        return { ...d, status: "completed" as const };
      }
      return d;
    });

    if (!outcome) {
      res.status(409).json({ error: "You have already played this duel." });
      return;
    }

    // Notify the other player.
    const otherId = isChallenger ? row.opponentVidyaId : row.challengerVidyaId;
    const [meUser] = await db
      .select({ name: usersTable.name })
      .from(usersTable)
      .where(eq(usersTable.vidyaId, me));
    const finished = outcome.status === "completed";
    await createNotification({
      recipientVidyaId: otherId,
      type: "duel",
      title: finished
        ? `Your Maths Duel with ${meUser?.name ?? "a classmate"} is complete! ⚔️`
        : `${meUser?.name ?? "A classmate"} played your Maths Duel ⚔️`,
      body: finished ? "Tap to see who won." : "Your turn — tap to play.",
      linkTab: "duels",
    });

    const names = new Map<string, string>();
    const nameRows = await db
      .select({ vidyaId: usersTable.vidyaId, name: usersTable.name })
      .from(usersTable)
      .where(inArray(usersTable.vidyaId, [outcome.challengerVidyaId, outcome.opponentVidyaId]));
    for (const n of nameRows) names.set(n.vidyaId, n.name);

    res.json(SubmitDuelResponse.parse(summarise(outcome as DuelRow, me, names)));
  },
);

export default router;
