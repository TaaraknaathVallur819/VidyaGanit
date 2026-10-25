import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import express from "express";
import request from "supertest";
import pinoHttp from "pino-http";
import { eq } from "drizzle-orm";

// Opt-in: only a disposable local database with this exact name is permitted.
// Provision it with the current Drizzle schema before running this file.
vi.mock("@workspace/db", async (original) => {
  const url = process.env.VIDYAGANIT_TEST_DATABASE_URL;
  if (!url) {
    return { ...(await import("@workspace/db/schema")), db: {}, pool: {} };
  }
  const parsed = new URL(url);
  if (
    parsed.hostname !== "127.0.0.1" ||
    parsed.pathname !== "/vidyaganit_regression"
  ) {
    throw new Error(
      "Use a disposable local vidyaganit_regression database only",
    );
  }
  process.env.DATABASE_URL = url;
  const actual = await original<typeof import("@workspace/db")>();
  actual.pool.options.ssl = false;
  return actual;
});
vi.mock("../middlewares/auth", () => ({
  requireAuth: (
    req: express.Request,
    _res: express.Response,
    next: express.NextFunction,
  ) => {
    req.vidyaId = "VG-STU-REGRESSION";
    next();
  },
  requireSelf: (
    _req: express.Request,
    _res: express.Response,
    next: express.NextFunction,
  ) => next(),
}));
vi.mock("../middlewares/rateLimit", () => ({
  rateLimit:
    () =>
    (
      _req: express.Request,
      _res: express.Response,
      next: express.NextFunction,
    ) =>
      next(),
}));
const streamControl = vi.hoisted(() => ({
  onStart: () => {},
  wait: Promise.resolve(),
}));
vi.mock("../lib/googleAi", () => ({ gemini: { models: {} } }));
vi.mock("../lib/aiChat", async (original) => ({
  ...(await original<typeof import("../lib/aiChat")>()),
  streamChat: async function* () {
    streamControl.onStart();
    await streamControl.wait;
    yield "How many equal parts can you see?";
  },
}));

import { db, pool, usersTable, assessmentsTable } from "@workspace/db";
import assessments from "./assessment";
import games from "./games";
import chat from "./chat";
import { awardActivityReward } from "../lib/activityReward";
import { computeXpAndBadges } from "../lib/xp";
import { computeStreakOnActivity, istToday } from "../lib/streak";

const studentId = "VG-STU-REGRESSION";
const app = express();
app.use(express.json());
app.use(pinoHttp({ enabled: false }));
app.use("/api", assessments, games, chat);

describe.skipIf(!process.env.VIDYAGANIT_TEST_DATABASE_URL)(
  "learning concurrency (local PostgreSQL)",
  () => {
    beforeAll(async () => {
      await db.insert(usersTable).values({
        vidyaId: studentId,
        name: "Local regression student",
        passwordHash: "unused",
        role: "student",
        gender: "male",
        studentClass: "5",
      });
      // Hold the first update briefly so competing requests read the same pending
      // assessment. This reproduces the race instead of relying on lucky timing.
      await pool.query(`
      CREATE FUNCTION regression_slow_assessment() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN PERFORM pg_sleep(0.1); RETURN NEW; END $$;
      CREATE TRIGGER regression_slow_assessment BEFORE UPDATE ON assessments
      FOR EACH ROW EXECUTE FUNCTION regression_slow_assessment();
    `);
    });
    beforeEach(async () => {
      streamControl.onStart = () => {};
      streamControl.wait = Promise.resolve();
      await db
        .delete(assessmentsTable)
        .where(eq(assessmentsTable.studentVidyaId, studentId));
      await db
        .update(usersTable)
        .set({
          xp: 90,
          coins: 90,
          badges: [],
          streakCurrent: 0,
          streakLongest: 0,
          lastActiveDate: null,
        })
        .where(eq(usersTable.vidyaId, studentId));
    });
    afterAll(async () => {
      try {
        await pool.query(
          "DROP TRIGGER IF EXISTS regression_slow_assessment ON assessments; DROP FUNCTION IF EXISTS regression_slow_assessment();",
        );
        await db.delete(usersTable).where(eq(usersTable.vidyaId, studentId));
      } finally {
        await pool.end();
      }
    });

    it("accepts only one concurrent submission and preserves the winning answers", async () => {
      await db.insert(assessmentsTable).values({
        testId: "concurrent-test",
        studentVidyaId: studentId,
        topic: "multiply",
        topicLabel: "Multiplication",
        totalQuestions: 1,
        questions: [
          { prompt: "2 × 3?", options: ["6", "5", "4", "3"], answerIndex: 0 },
        ],
      });
      const responses = await Promise.all(
        Array.from({ length: 8 }, (_, i) =>
          request(app)
            .post("/api/assessment/submit")
            .send({ testId: "concurrent-test", answers: [i % 4] }),
        ),
      );
      expect(responses.filter((r) => r.status === 200)).toHaveLength(1);
      expect(responses.filter((r) => r.status === 409)).toHaveLength(7);
      const winner = responses.find((r) => r.status === 200)!;
      const [saved] = await db
        .select()
        .from(assessmentsTable)
        .where(eq(assessmentsTable.testId, "concurrent-test"));
      expect(saved.submittedAnswers).toEqual(
        winner.body.review.map((q: { chosenIndex: number }) => q.chosenIndex),
      );
      expect(saved.score).toBe(winner.body.score);
    });

    it("preserves every game reward and awards the century badge once", async () => {
      const responses = await Promise.all(
        Array.from({ length: 8 }, () =>
          request(app)
            .post("/api/games/score")
            .send({ vidyaId: studentId, game: "multiply", score: 10 }),
        ),
      );
      expect(responses.every((r) => r.status === 200)).toBe(true);
      expect(responses.flatMap((r) => r.body.newBadges)).toEqual([
        "century_club",
      ]);
      const [saved] = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.vidyaId, studentId));
      expect(saved.xp).toBe(170);
      expect(saved.coins).toBe(170);
      expect(saved.badges).toEqual(["century_club"]);
    });

    it("computes chat bonuses from current badges and updates today's streak once", async () => {
      await db
        .update(usersTable)
        .set({ xp: 0, coins: 0 })
        .where(eq(usersTable.vidyaId, studentId));
      const rewards = await Promise.all(
        Array.from({ length: 6 }, () =>
          awardActivityReward(studentId, (current) => ({
            ...computeXpAndBadges({
              topic: "fraction",
              message: "What is a fraction?",
              currentXp: current.xp,
              existingBadges: current.badges,
              historyLength: 0,
            }),
            streak: computeStreakOnActivity(current),
          })),
        ),
      );
      expect(rewards.reduce((sum, reward) => sum + reward!.xpAwarded, 0)).toBe(
        75,
      );
      const [saved] = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.vidyaId, studentId));
      expect(saved.xp).toBe(75);
      expect(saved.coins).toBe(75);
      expect(saved.badges.sort()).toEqual(["first_step", "fraction_friend"]);
      expect(saved.streakCurrent).toBe(1);
      expect(saved.lastActiveDate).toBe(istToday());
    });

    it("does not refund coins spent while a chat reply was being generated", async () => {
      // Emulate a purchase with a held row lock before the delayed reward arrives.
      const connection = await pool.connect();
      try {
        await connection.query("BEGIN");
        await connection.query(
          "UPDATE users SET coins = coins - 50 WHERE vidya_id = $1",
          [studentId],
        );
        const reward = awardActivityReward(studentId, () => ({
          xpGained: 10,
          newBadges: [],
        }));
        await connection.query("COMMIT");
        await reward;
        const [saved] = await db
          .select()
          .from(usersTable)
          .where(eq(usersTable.vidyaId, studentId));
        expect(saved.coins).toBe(50);
        expect(saved.xp).toBe(100);
      } finally {
        await connection.query("ROLLBACK");
        connection.release();
      }
    });

    it("preserves game rewards and purchases made during a streamed chat response", async () => {
      let release!: () => void;
      const started = new Promise<void>((resolve) => {
        streamControl.onStart = resolve;
      });
      streamControl.wait = new Promise<void>((resolve) => {
        release = resolve;
      });
      const pending = request(app)
        .post("/api/chat/message")
        .send({
          vidyaId: studentId,
          message: "What is a fraction?",
          sessionId: "reward-regression",
          history: [],
        })
        .then((response) => response);
      try {
        await started;
        const game = await request(app)
          .post("/api/games/score")
          .send({ vidyaId: studentId, game: "multiply", score: 10 });
        expect(game.status).toBe(200);
        await pool.query(
          "UPDATE users SET coins = coins - 50 WHERE vidya_id = $1",
          [studentId],
        );
      } finally {
        release();
      }
      const response = await pending;
      expect(response.status).toBe(200);
      expect(response.text).toContain('"done":true');
      const [saved] = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.vidyaId, studentId));
      expect(saved.xp).toBe(125);
      expect(saved.coins).toBe(75);
      expect(saved.badges.sort()).toEqual([
        "century_club",
        "first_step",
        "fraction_friend",
      ]);
    });
  },
);
