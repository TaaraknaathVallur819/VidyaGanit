import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

// ── Mock the OpenAI integration so the Socratic tutor chat never makes real
// network calls during tests. Both the chat stream and image generation are
// stubbed (the latter only fires when the model emits a [[DRAW]] marker). ──
const mocks = vi.hoisted(() => ({
  chatCreate: vi.fn(),
  generateImageBuffer: vi.fn(),
}));

vi.mock("@workspace/integrations-openai-ai-server", () => ({
  openai: { chat: { completions: { create: mocks.chatCreate } } },
}));

vi.mock("@workspace/integrations-openai-ai-server/image", () => ({
  generateImageBuffer: mocks.generateImageBuffer,
}));

import app from "../app";
import { signSession, SESSION_COOKIE } from "../lib/session";
import { db, usersTable, chatMessagesTable, rateLimitBucketsTable } from "@workspace/db";
import { eq, inArray, like } from "drizzle-orm";

// Unique-per-run id prefix so test rows never collide with real data and are
// trivially identifiable for cleanup.
const RUN = `TST-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
const STUDENT_A = `${RUN}-STU-A`;
const STUDENT_B = `${RUN}-STU-B`;

const ALL_VIDYA_IDS = [STUDENT_A, STUDENT_B];

/** Builds a signed-session Cookie header value for the given user. */
function cookieFor(vidyaId: string): string {
  return `${SESSION_COOKIE}=${signSession(vidyaId)}`;
}

/** An async-iterable mimicking the OpenAI streaming chat response. */
function makeStream(chunks: string[]) {
  return {
    async *[Symbol.asyncIterator]() {
      for (const c of chunks) {
        yield { choices: [{ delta: { content: c } }] };
      }
    },
  };
}

/**
 * Push a rate-limit bucket at/over its limit for the *current* window so the
 * next request through the limiter is rejected. Mirrors the key format used by
 * `rateLimit` (`<prefix>:<identity>:<windowStart>`).
 */
async function seedRateLimitAtLimit(
  keyPrefix: string,
  identity: string,
  windowMs: number,
  count: number,
): Promise<void> {
  const windowStart = Math.floor(Date.now() / windowMs) * windowMs;
  const resetAt = new Date(windowStart + windowMs);
  const key = `${keyPrefix}:${identity}:${windowStart}`;
  await db
    .insert(rateLimitBucketsTable)
    .values({ key, count, resetAt })
    .onConflictDoUpdate({ target: rateLimitBucketsTable.key, set: { count } });
}

async function clearRateLimitBuckets(): Promise<void> {
  await db.delete(rateLimitBucketsTable).where(like(rateLimitBucketsTable.key, `%${RUN}%`));
}

async function clearChatMessages(): Promise<void> {
  await db.delete(chatMessagesTable).where(inArray(chatMessagesTable.studentVidyaId, ALL_VIDYA_IDS));
}

beforeAll(async () => {
  await db.insert(usersTable).values([
    {
      vidyaId: STUDENT_A,
      name: "Student A",
      passwordHash: "x",
      role: "student",
      gender: "male",
      studentClass: "5",
      board: "CBSE",
    },
    {
      vidyaId: STUDENT_B,
      name: "Student B",
      passwordHash: "x",
      role: "student",
      gender: "female",
      studentClass: "6",
      board: "ICSE",
    },
  ]);
});

afterAll(async () => {
  await clearRateLimitBuckets();
  await clearChatMessages();
  await db.delete(usersTable).where(inArray(usersTable.vidyaId, ALL_VIDYA_IDS));
});

beforeEach(async () => {
  vi.clearAllMocks();
  mocks.chatCreate.mockResolvedValue(makeStream(["Let's ", "think step by step."]));
  await clearRateLimitBuckets();
  await clearChatMessages();
});

describe("POST /chat/message", () => {
  const url = "/api/chat/message";

  it("streams a tutor reply for the authenticated student", async () => {
    const res = await request(app)
      .post(url)
      .set("Cookie", cookieFor(STUDENT_A))
      .send({ vidyaId: STUDENT_A, message: "How do I add 1/2 and 1/3?" });

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("text/event-stream");
    expect(res.text).toContain("Let's ");
    expect(res.text).toContain('"done":true');
    expect(mocks.chatCreate).toHaveBeenCalledTimes(1);
  });

  it("rejects unauthenticated requests with 401", async () => {
    const res = await request(app).post(url).send({ vidyaId: STUDENT_A, message: "Hi" });
    expect(res.status).toBe(401);
    expect(mocks.chatCreate).not.toHaveBeenCalled();
  });

  it("takes the student identity from the cookie, never the request body", async () => {
    // Logged in as A but the body claims to be B — the message and XP must be
    // attributed to A (the cookie), and B must be left completely untouched.
    const res = await request(app)
      .post(url)
      .set("Cookie", cookieFor(STUDENT_A))
      .send({ vidyaId: STUDENT_B, message: "Whose account is this?" });

    expect(res.status).toBe(200);
    expect(res.text).toContain('"done":true');

    const aRows = await db
      .select()
      .from(chatMessagesTable)
      .where(eq(chatMessagesTable.studentVidyaId, STUDENT_A));
    const bRows = await db
      .select()
      .from(chatMessagesTable)
      .where(eq(chatMessagesTable.studentVidyaId, STUDENT_B));

    // The student message was logged under A (the cookie), not B (the body).
    expect(aRows.some((r) => r.role === "user" && r.content.includes("Whose account is this?"))).toBe(
      true,
    );
    expect(bRows).toHaveLength(0);

    // XP is awarded to A; B's account is never modified.
    const [a] = await db.select().from(usersTable).where(eq(usersTable.vidyaId, STUDENT_A));
    const [b] = await db.select().from(usersTable).where(eq(usersTable.vidyaId, STUDENT_B));
    expect((a.xp ?? 0)).toBeGreaterThan(0);
    expect((b.xp ?? 0)).toBe(0);
  });

  it("returns 429 once the per-minute rate limit is exceeded", async () => {
    // The per-minute limiter allows 20; pre-fill the window so the next call trips it.
    await seedRateLimitAtLimit("chat-minute", STUDENT_A, 60_000, 20);
    const res = await request(app)
      .post(url)
      .set("Cookie", cookieFor(STUDENT_A))
      .send({ vidyaId: STUDENT_A, message: "One more question" });

    expect(res.status).toBe(429);
    expect(res.headers["retry-after"]).toBeDefined();
    expect(mocks.chatCreate).not.toHaveBeenCalled();
  });
});
