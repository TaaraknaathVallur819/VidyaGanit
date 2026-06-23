import { Router, type IRouter } from "express";
import { and, desc, eq, inArray, lte, sql } from "drizzle-orm";
import {
  db,
  usersTable,
  dailyChallengeCompletionsTable,
  reviewItemsTable,
  purchasesTable,
  assignmentsTable,
  assignmentCompletionsTable,
  parentStudentLinksTable,
  assessmentsTable,
} from "@workspace/db";
import {
  GetLeaderboardParams,
  GetLeaderboardResponse,
  GetDailyChallengeParams,
  GetDailyChallengeResponse,
  SubmitDailyChallengeParams,
  SubmitDailyChallengeBody,
  GetReviewDueParams,
  GetReviewDueResponse,
  GradeReviewItemParams,
  GradeReviewItemBody,
  GetShopParams,
  GetShopResponse,
  BuyShopItemParams,
  BuyShopItemBody,
  EquipShopItemParams,
  EquipShopItemBody,
  GetStudentAssignmentsParams,
  GetStudentAssignmentsResponse,
  CompleteAssignmentParams,
} from "@workspace/api-zod";
import { requireAuth, requireSelf } from "../middlewares/auth";
import { rateLimit } from "../middlewares/rateLimit";
import { istToday } from "../lib/streak";
import { generateDailyChallenge } from "../lib/dailyChallenge";
import { SHOP_CATALOG, findShopItem } from "../lib/shop";
import { scheduleReview } from "../lib/spacedRepetition";
import { collectMistakes, topicLabel } from "../lib/assessment";

const router: IRouter = Router();

/** Levels mirror the client thresholds (StudentDashboard.getLevelInfo). */
export function levelFromXp(xp: number): number {
  if (xp >= 1000) return 5;
  if (xp >= 500) return 4;
  if (xp >= 250) return 3;
  if (xp >= 100) return 2;
  return 1;
}

async function studentBatches(vidyaId: string, ownBatch: string | null) {
  const links = await db
    .select({ batch: parentStudentLinksTable.batch })
    .from(parentStudentLinksTable)
    .where(eq(parentStudentLinksTable.studentVidyaId, vidyaId));
  const set = new Set<string>();
  if (ownBatch) set.add(ownBatch);
  for (const l of links) if (l.batch) set.add(l.batch);
  return [...set];
}

// ── Leaderboard ─────────────────────────────────────────────────────
router.get(
  "/leaderboard/:vidyaId",
  requireAuth,
  requireSelf,
  async (req, res): Promise<void> => {
    const params = GetLeaderboardParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const [self] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.vidyaId, params.data.vidyaId));
    if (!self) {
      res.status(404).json({ error: "Student not found" });
      return;
    }

    let scope: "batch" | "class" | "global" = "global";
    let peers = await db
      .select({ vidyaId: usersTable.vidyaId, name: usersTable.name, xp: usersTable.xp })
      .from(usersTable)
      .where(eq(usersTable.role, "student"));

    if (self.batch) {
      const inBatch = peers.filter((p) => p.vidyaId !== self.vidyaId);
      const batchPeers = await db
        .select({ vidyaId: usersTable.vidyaId, name: usersTable.name, xp: usersTable.xp })
        .from(usersTable)
        .where(and(eq(usersTable.role, "student"), eq(usersTable.batch, self.batch)));
      if (batchPeers.length > 1) {
        scope = "batch";
        peers = batchPeers;
      } else {
        void inBatch;
      }
    }
    if (scope === "global" && self.studentClass) {
      const classPeers = await db
        .select({ vidyaId: usersTable.vidyaId, name: usersTable.name, xp: usersTable.xp })
        .from(usersTable)
        .where(
          and(eq(usersTable.role, "student"), eq(usersTable.studentClass, self.studentClass)),
        );
      if (classPeers.length > 1) {
        scope = "class";
        peers = classPeers;
      }
    }

    const ranked = peers
      .slice()
      .sort((a, b) => b.xp - a.xp || a.name.localeCompare(b.name));
    const selfRank = ranked.findIndex((p) => p.vidyaId === self.vidyaId) + 1;
    const entries = ranked.slice(0, 50).map((p, i) => ({
      rank: i + 1,
      name: p.name,
      xp: p.xp,
      level: levelFromXp(p.xp),
      isSelf: p.vidyaId === self.vidyaId,
    }));

    res.json(GetLeaderboardResponse.parse({ scope, selfRank, entries }));
  },
);

// ── Daily Challenge ─────────────────────────────────────────────────
router.get(
  "/daily-challenge/:vidyaId",
  requireAuth,
  requireSelf,
  async (req, res): Promise<void> => {
    const params = GetDailyChallengeParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const [self] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.vidyaId, params.data.vidyaId));
    if (!self) {
      res.status(404).json({ error: "Student not found" });
      return;
    }
    const date = istToday();
    const challenge = generateDailyChallenge(date, self.studentClass ?? null);
    const [done] = await db
      .select()
      .from(dailyChallengeCompletionsTable)
      .where(
        and(
          eq(dailyChallengeCompletionsTable.vidyaId, self.vidyaId),
          eq(dailyChallengeCompletionsTable.challengeDate, date),
        ),
      );
    res.json(
      GetDailyChallengeResponse.parse({
        date,
        question: challenge.question,
        options: challenge.options,
        completed: !!done,
        correct: done ? done.correct : null,
        xpAwarded: done ? done.xpAwarded : 0,
      }),
    );
  },
);

router.post(
  "/daily-challenge/:vidyaId/submit",
  requireAuth,
  requireSelf,
  rateLimit({ windowMs: 60_000, max: 10, keyPrefix: "daily-challenge" }),
  async (req, res): Promise<void> => {
    const params = SubmitDailyChallengeParams.safeParse(req.params);
    const body = SubmitDailyChallengeBody.safeParse(req.body);
    if (!params.success || !body.success) {
      res.status(400).json({ error: "Invalid input" });
      return;
    }
    const [self] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.vidyaId, params.data.vidyaId));
    if (!self) {
      res.status(404).json({ error: "Student not found" });
      return;
    }
    const date = istToday();
    const challenge = generateDailyChallenge(date, self.studentClass ?? null);
    const correct = body.data.answer === challenge.answer;
    const xpAwarded = correct ? 25 : 5;
    // The unique (vidyaId, challengeDate) constraint is the source of truth:
    // onConflictDoNothing returns no row when today's challenge is already done,
    // so two concurrent submits can never both award XP/coins.
    const alreadyDone = await db.transaction(async (tx) => {
      const inserted = await tx
        .insert(dailyChallengeCompletionsTable)
        .values({
          vidyaId: self.vidyaId,
          challengeDate: date,
          correct,
          xpAwarded,
        })
        .onConflictDoNothing()
        .returning({ id: dailyChallengeCompletionsTable.id });
      if (inserted.length === 0) return true;
      await tx
        .update(usersTable)
        .set({
          xp: sql`${usersTable.xp} + ${xpAwarded}`,
          coins: sql`${usersTable.coins} + ${xpAwarded}`,
        })
        .where(eq(usersTable.vidyaId, self.vidyaId));
      return false;
    });
    if (alreadyDone) {
      res.status(400).json({ error: "You've already done today's challenge!" });
      return;
    }
    res.json(
      GetDailyChallengeResponse.parse({
        date,
        question: challenge.question,
        options: challenge.options,
        completed: true,
        correct,
        xpAwarded,
      }),
    );
  },
);

// ── Smart Review (spaced repetition) ────────────────────────────────
async function seedReviewItems(vidyaId: string): Promise<void> {
  const rows = await db
    .select()
    .from(assessmentsTable)
    .where(
      and(
        eq(assessmentsTable.studentVidyaId, vidyaId),
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
      questions: r.questions,
      submittedAnswers: r.submittedAnswers ?? null,
    })),
  );
  if (mistakes.length === 0) return;
  const today = istToday();
  for (const m of mistakes) {
    await db
      .insert(reviewItemsTable)
      .values({
        vidyaId,
        mistakeKey: `${m.testId}:${m.prompt}`,
        question: m.prompt,
        topic: m.topicLabel,
        dueDate: today,
      })
      .onConflictDoNothing();
  }
}

async function reviewDuePayload(vidyaId: string) {
  const today = istToday();
  const all = await db
    .select()
    .from(reviewItemsTable)
    .where(eq(reviewItemsTable.vidyaId, vidyaId));
  const due = all
    .filter((r) => r.dueDate <= today)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  return {
    dueCount: due.length,
    totalCount: all.length,
    items: due.slice(0, 30).map((r) => ({
      id: r.id,
      question: r.question,
      topic: r.topic ?? null,
    })),
  };
}

router.get(
  "/review/:vidyaId/due",
  requireAuth,
  requireSelf,
  async (req, res): Promise<void> => {
    const params = GetReviewDueParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    await seedReviewItems(params.data.vidyaId);
    res.json(GetReviewDueResponse.parse(await reviewDuePayload(params.data.vidyaId)));
  },
);

router.post(
  "/review/:vidyaId/grade",
  requireAuth,
  requireSelf,
  async (req, res): Promise<void> => {
    const params = GradeReviewItemParams.safeParse(req.params);
    const body = GradeReviewItemBody.safeParse(req.body);
    if (!params.success || !body.success) {
      res.status(400).json({ error: "Invalid input" });
      return;
    }
    const [item] = await db
      .select()
      .from(reviewItemsTable)
      .where(
        and(
          eq(reviewItemsTable.id, body.data.itemId),
          eq(reviewItemsTable.vidyaId, params.data.vidyaId),
        ),
      );
    if (!item) {
      res.status(400).json({ error: "Review item not found" });
      return;
    }
    const next = scheduleReview(
      {
        intervalDays: item.intervalDays,
        ease: item.ease,
        repetitions: item.repetitions,
      },
      body.data.quality,
    );
    await db
      .update(reviewItemsTable)
      .set({
        intervalDays: next.intervalDays,
        ease: next.ease,
        repetitions: next.repetitions,
        dueDate: next.dueDate,
        lastReviewedAt: new Date(),
      })
      .where(eq(reviewItemsTable.id, item.id));
    // Small reward for reviewing.
    await db
      .update(usersTable)
      .set({ xp: sql`${usersTable.xp} + 3`, coins: sql`${usersTable.coins} + 3` })
      .where(eq(usersTable.vidyaId, params.data.vidyaId));
    res.json(GetReviewDueResponse.parse(await reviewDuePayload(params.data.vidyaId)));
  },
);

// ── Reward Shop ─────────────────────────────────────────────────────
async function shopPayload(vidyaId: string) {
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.vidyaId, vidyaId));
  const owned = new Set(
    (
      await db
        .select({ itemId: purchasesTable.itemId })
        .from(purchasesTable)
        .where(eq(purchasesTable.vidyaId, vidyaId))
    ).map((p) => p.itemId),
  );
  return {
    coins: user?.coins ?? 0,
    equippedAvatar: user?.equippedAvatar ?? null,
    equippedTheme: user?.equippedTheme ?? null,
    items: SHOP_CATALOG.map((item) => ({
      ...item,
      owned: owned.has(item.id),
      equipped:
        (item.kind === "avatar" && user?.equippedAvatar === item.id) ||
        (item.kind === "theme" && user?.equippedTheme === item.id),
    })),
  };
}

router.get(
  "/shop/:vidyaId",
  requireAuth,
  requireSelf,
  async (req, res): Promise<void> => {
    const params = GetShopParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    res.json(GetShopResponse.parse(await shopPayload(params.data.vidyaId)));
  },
);

router.post(
  "/shop/:vidyaId/buy",
  requireAuth,
  requireSelf,
  async (req, res): Promise<void> => {
    const params = BuyShopItemParams.safeParse(req.params);
    const body = BuyShopItemBody.safeParse(req.body);
    if (!params.success || !body.success) {
      res.status(400).json({ error: "Invalid input" });
      return;
    }
    const item = findShopItem(body.data.itemId);
    if (!item) {
      res.status(400).json({ error: "Unknown item" });
      return;
    }
    // Lock the user row for the duration of the purchase so concurrent buys
    // are serialized: this prevents double-spend and stale-balance overwrites.
    const outcome = await db.transaction(async (tx) => {
      const [user] = await tx
        .select({ coins: usersTable.coins })
        .from(usersTable)
        .where(eq(usersTable.vidyaId, params.data.vidyaId))
        .for("update");
      if (!user) return "notfound" as const;
      const [already] = await tx
        .select({ id: purchasesTable.id })
        .from(purchasesTable)
        .where(
          and(
            eq(purchasesTable.vidyaId, params.data.vidyaId),
            eq(purchasesTable.itemId, item.id),
          ),
        );
      if (already) return "owned" as const;
      if ((user.coins ?? 0) < item.price) return "poor" as const;
      await tx
        .insert(purchasesTable)
        .values({ vidyaId: params.data.vidyaId, itemId: item.id });
      await tx
        .update(usersTable)
        .set({ coins: sql`${usersTable.coins} - ${item.price}` })
        .where(eq(usersTable.vidyaId, params.data.vidyaId));
      return "ok" as const;
    });
    if (outcome === "notfound") {
      res.status(404).json({ error: "Student not found" });
      return;
    }
    if (outcome === "owned") {
      res.status(400).json({ error: "You already own this." });
      return;
    }
    if (outcome === "poor") {
      res.status(400).json({ error: "Not enough coins yet — keep practising!" });
      return;
    }
    res.json(GetShopResponse.parse(await shopPayload(params.data.vidyaId)));
  },
);

router.post(
  "/shop/:vidyaId/equip",
  requireAuth,
  requireSelf,
  async (req, res): Promise<void> => {
    const params = EquipShopItemParams.safeParse(req.params);
    const body = EquipShopItemBody.safeParse(req.body);
    if (!params.success || !body.success) {
      res.status(400).json({ error: "Invalid input" });
      return;
    }
    const itemId = body.data.itemId ?? null;
    if (itemId) {
      const item = findShopItem(itemId);
      if (!item || item.kind !== body.data.kind) {
        res.status(400).json({ error: "Unknown item" });
        return;
      }
      const [owned] = await db
        .select()
        .from(purchasesTable)
        .where(
          and(
            eq(purchasesTable.vidyaId, params.data.vidyaId),
            eq(purchasesTable.itemId, itemId),
          ),
        );
      if (!owned) {
        res.status(400).json({ error: "You don't own this item." });
        return;
      }
    }
    await db
      .update(usersTable)
      .set(
        body.data.kind === "avatar"
          ? { equippedAvatar: itemId }
          : { equippedTheme: itemId },
      )
      .where(eq(usersTable.vidyaId, params.data.vidyaId));
    res.json(GetShopResponse.parse(await shopPayload(params.data.vidyaId)));
  },
);

// ── Student Assignments ─────────────────────────────────────────────
async function studentAssignmentsPayload(vidyaId: string, ownBatch: string | null) {
  const batches = await studentBatches(vidyaId, ownBatch);
  if (batches.length === 0) return { assignments: [] };
  const rows = await db
    .select()
    .from(assignmentsTable)
    .where(inArray(assignmentsTable.batch, batches))
    .orderBy(desc(assignmentsTable.createdAt));
  const completions = await db
    .select()
    .from(assignmentCompletionsTable)
    .where(eq(assignmentCompletionsTable.studentVidyaId, vidyaId));
  const statusByAssignment = new Map(
    completions.map((c) => [c.assignmentId, c.status]),
  );
  const tutorIds = [...new Set(rows.map((r) => r.tutorVidyaId))];
  const tutorNames = new Map<string, string>();
  if (tutorIds.length > 0) {
    const tutors = await db
      .select({ vidyaId: usersTable.vidyaId, name: usersTable.name })
      .from(usersTable)
      .where(inArray(usersTable.vidyaId, tutorIds));
    for (const t of tutors) tutorNames.set(t.vidyaId, t.name);
  }
  return {
    assignments: rows.map((r) => ({
      id: r.id,
      title: r.title,
      description: r.description ?? null,
      kind: r.kind,
      topic: r.topic ?? null,
      dueDate: r.dueDate ?? null,
      status: statusByAssignment.get(r.id) ?? "pending",
      tutorName: tutorNames.get(r.tutorVidyaId) ?? null,
    })),
  };
}

router.get(
  "/assignments/:vidyaId",
  requireAuth,
  requireSelf,
  async (req, res): Promise<void> => {
    const params = GetStudentAssignmentsParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const [self] = await db
      .select({ batch: usersTable.batch })
      .from(usersTable)
      .where(eq(usersTable.vidyaId, params.data.vidyaId));
    res.json(
      GetStudentAssignmentsResponse.parse(
        await studentAssignmentsPayload(params.data.vidyaId, self?.batch ?? null),
      ),
    );
  },
);

router.post(
  "/assignments/:vidyaId/:assignmentId/complete",
  requireAuth,
  requireSelf,
  async (req, res): Promise<void> => {
    const params = CompleteAssignmentParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const [self] = await db
      .select({ batch: usersTable.batch, xp: usersTable.xp, coins: usersTable.coins })
      .from(usersTable)
      .where(eq(usersTable.vidyaId, params.data.vidyaId));
    const batches = await studentBatches(params.data.vidyaId, self?.batch ?? null);
    const [assignment] = await db
      .select()
      .from(assignmentsTable)
      .where(eq(assignmentsTable.id, params.data.assignmentId));
    if (!assignment || !batches.includes(assignment.batch)) {
      res.status(404).json({ error: "Assignment not found" });
      return;
    }
    // Reward is granted only on the first insert that wins the unique
    // (assignmentId, studentVidyaId) constraint, so concurrent or repeated
    // completes can never double-award XP/coins.
    await db.transaction(async (tx) => {
      const inserted = await tx
        .insert(assignmentCompletionsTable)
        .values({
          assignmentId: assignment.id,
          studentVidyaId: params.data.vidyaId,
          status: "completed",
          completedAt: new Date(),
        })
        .onConflictDoNothing()
        .returning({ id: assignmentCompletionsTable.id });
      if (inserted.length > 0) {
        await tx
          .update(usersTable)
          .set({ xp: sql`${usersTable.xp} + 15`, coins: sql`${usersTable.coins} + 15` })
          .where(eq(usersTable.vidyaId, params.data.vidyaId));
      }
    });
    res.json(
      GetStudentAssignmentsResponse.parse(
        await studentAssignmentsPayload(params.data.vidyaId, self?.batch ?? null),
      ),
    );
  },
);

export default router;
