import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

// ── Mock the OpenAI integration so the parent strategy-AI and transcribe
// endpoints never make real network calls during tests. ──────────────────
const mocks = vi.hoisted(() => ({
  chatCreate: vi.fn(),
  speechToText: vi.fn(),
  ensureCompatibleFormat: vi.fn(),
}));

vi.mock("@workspace/integrations-openai-ai-server", () => ({
  openai: { chat: { completions: { create: mocks.chatCreate } } },
}));

vi.mock("@workspace/integrations-openai-ai-server/audio", () => ({
  speechToText: mocks.speechToText,
  ensureCompatibleFormat: mocks.ensureCompatibleFormat,
}));

import app from "../app";
import { signSession, SESSION_COOKIE } from "../lib/session";
import {
  db,
  usersTable,
  parentStudentLinksTable,
  chatMessagesTable,
  parentChatMessagesTable,
  rateLimitBucketsTable,
} from "@workspace/db";
import { eq, inArray, like } from "drizzle-orm";

// Unique-per-run id prefix so test rows never collide with real data and are
// trivially identifiable for cleanup.
const RUN = `TST-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
const PARENT_A = `${RUN}-PARENT-A`;
const PARENT_B = `${RUN}-PARENT-B`;
const STUDENT_LINKED = `${RUN}-STU-LINKED`;
const STUDENT_UNLINKED = `${RUN}-STU-UNLINKED`;

const ALL_VIDYA_IDS = [PARENT_A, PARENT_B, STUDENT_LINKED, STUDENT_UNLINKED];

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

beforeAll(async () => {
  // Two parents, a linked child of A, and an unlinked child.
  await db.insert(usersTable).values([
    { vidyaId: PARENT_A, name: "Parent A", passwordHash: "x", role: "parent", gender: "f" },
    { vidyaId: PARENT_B, name: "Parent B", passwordHash: "x", role: "parent", gender: "m" },
    {
      vidyaId: STUDENT_LINKED,
      name: "Linked Child",
      passwordHash: "x",
      role: "student",
      gender: "m",
      studentClass: "5",
      board: "CBSE",
    },
    {
      vidyaId: STUDENT_UNLINKED,
      name: "Unlinked Child",
      passwordHash: "x",
      role: "student",
      gender: "f",
      studentClass: "6",
      board: "ICSE",
    },
  ]);

  await db
    .insert(parentStudentLinksTable)
    .values({ parentVidyaId: PARENT_A, studentVidyaId: STUDENT_LINKED });

  // Some tutor activity for the linked child so analytics/history have content.
  await db.insert(chatMessagesTable).values([
    { sessionId: "sess-1", studentVidyaId: STUDENT_LINKED, role: "user", content: "How do I add 1/2 and 1/3 fractions?" },
    { sessionId: "sess-1", studentVidyaId: STUDENT_LINKED, role: "assistant", content: "Let's think about it step by step." },
    { sessionId: "sess-2", studentVidyaId: STUDENT_LINKED, role: "user", content: "What is 0.5 as a decimal?" },
  ]);
});

afterAll(async () => {
  await clearRateLimitBuckets();
  await db.delete(parentChatMessagesTable).where(inArray(parentChatMessagesTable.parentVidyaId, ALL_VIDYA_IDS));
  await db.delete(chatMessagesTable).where(inArray(chatMessagesTable.studentVidyaId, ALL_VIDYA_IDS));
  // parent_student_links + chat rows cascade on user delete, but be explicit.
  await db.delete(parentStudentLinksTable).where(inArray(parentStudentLinksTable.parentVidyaId, ALL_VIDYA_IDS));
  await db.delete(usersTable).where(inArray(usersTable.vidyaId, ALL_VIDYA_IDS));
});

beforeEach(async () => {
  vi.clearAllMocks();
  mocks.chatCreate.mockResolvedValue(makeStream(["Here ", "is some advice."]));
  mocks.ensureCompatibleFormat.mockResolvedValue({ buffer: Buffer.from("audio"), format: "wav" });
  mocks.speechToText.mockResolvedValue("transcribed text");
  await clearRateLimitBuckets();
});

// A tiny valid base64 data URL for transcribe tests.
const AUDIO_DATA_URL = `data:audio/webm;base64,${Buffer.from("fake-audio").toString("base64")}`;

describe("GET /parent/:vidyaId/students/:studentVidyaId/analytics", () => {
  const url = (parent: string, student: string) =>
    `/api/parent/${parent}/students/${student}/analytics`;

  it("returns analytics for the authenticated owner's linked child", async () => {
    const res = await request(app)
      .get(url(PARENT_A, STUDENT_LINKED))
      .set("Cookie", cookieFor(PARENT_A));

    expect(res.status).toBe(200);
    expect(res.body.studentVidyaId).toBe(STUDENT_LINKED);
    expect(res.body.totalMessages).toBe(2); // only the two "user" rows
    expect(res.body.totalSessions).toBe(2);
    expect(Array.isArray(res.body.topics)).toBe(true);
  });

  it("rejects unauthenticated requests with 401", async () => {
    const res = await request(app).get(url(PARENT_A, STUDENT_LINKED));
    expect(res.status).toBe(401);
  });

  it("rejects cross-account access with 403", async () => {
    const res = await request(app)
      .get(url(PARENT_B, STUDENT_LINKED))
      .set("Cookie", cookieFor(PARENT_A));
    expect(res.status).toBe(403);
  });

  it("rejects an unlinked student with 403", async () => {
    const res = await request(app)
      .get(url(PARENT_A, STUDENT_UNLINKED))
      .set("Cookie", cookieFor(PARENT_A));
    expect(res.status).toBe(403);
  });
});

describe("GET /parent/:vidyaId/students/:studentVidyaId/history", () => {
  const url = (parent: string, student: string) =>
    `/api/parent/${parent}/students/${student}/history`;

  it("returns saved history for the authenticated owner's linked child", async () => {
    const res = await request(app)
      .get(url(PARENT_A, STUDENT_LINKED))
      .set("Cookie", cookieFor(PARENT_A));

    expect(res.status).toBe(200);
    expect(res.body.studentVidyaId).toBe(STUDENT_LINKED);
    expect(res.body.sessions.length).toBe(2);
  });

  it("rejects unauthenticated requests with 401", async () => {
    const res = await request(app).get(url(PARENT_A, STUDENT_LINKED));
    expect(res.status).toBe(401);
  });

  it("rejects cross-account access with 403", async () => {
    const res = await request(app)
      .get(url(PARENT_B, STUDENT_LINKED))
      .set("Cookie", cookieFor(PARENT_A));
    expect(res.status).toBe(403);
  });

  it("rejects an unlinked student with 403", async () => {
    const res = await request(app)
      .get(url(PARENT_A, STUDENT_UNLINKED))
      .set("Cookie", cookieFor(PARENT_A));
    expect(res.status).toBe(403);
  });
});

describe("POST /parent/:vidyaId/consultant/message", () => {
  const url = (parent: string) => `/api/parent/${parent}/consultant/message`;

  it("streams a counselor reply for the authenticated owner", async () => {
    const res = await request(app)
      .post(url(PARENT_A))
      .set("Cookie", cookieFor(PARENT_A))
      .send({ message: "How can I help my child with fractions?" });

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("text/event-stream");
    expect(res.text).toContain("Here ");
    expect(res.text).toContain('"done":true');
    expect(mocks.chatCreate).toHaveBeenCalledTimes(1);
  });

  it("accepts a linked studentVidyaId for grounded advice", async () => {
    const res = await request(app)
      .post(url(PARENT_A))
      .set("Cookie", cookieFor(PARENT_A))
      .send({ message: "How is my child doing?", studentVidyaId: STUDENT_LINKED });

    expect(res.status).toBe(200);
    expect(res.text).toContain('"done":true');
  });

  it("rejects unauthenticated requests with 401", async () => {
    const res = await request(app).post(url(PARENT_A)).send({ message: "Hi" });
    expect(res.status).toBe(401);
  });

  it("rejects cross-account access with 403", async () => {
    const res = await request(app)
      .post(url(PARENT_B))
      .set("Cookie", cookieFor(PARENT_A))
      .send({ message: "Hi" });
    expect(res.status).toBe(403);
    expect(mocks.chatCreate).not.toHaveBeenCalled();
  });

  it("rejects an unlinked studentVidyaId with 403", async () => {
    const res = await request(app)
      .post(url(PARENT_A))
      .set("Cookie", cookieFor(PARENT_A))
      .send({ message: "How is this child?", studentVidyaId: STUDENT_UNLINKED });
    expect(res.status).toBe(403);
    expect(mocks.chatCreate).not.toHaveBeenCalled();
  });

  it("returns 429 once the per-minute rate limit is exceeded", async () => {
    // The per-minute limiter allows 20; pre-fill the window so the next call trips it.
    await seedRateLimitAtLimit("parent-consult-minute", PARENT_A, 60_000, 20);
    const res = await request(app)
      .post(url(PARENT_A))
      .set("Cookie", cookieFor(PARENT_A))
      .send({ message: "One more question" });

    expect(res.status).toBe(429);
    expect(res.headers["retry-after"]).toBeDefined();
    expect(mocks.chatCreate).not.toHaveBeenCalled();
  });
});

describe("POST /parent/:vidyaId/consultant/transcribe", () => {
  const url = (parent: string) => `/api/parent/${parent}/consultant/transcribe`;

  it("transcribes audio for the authenticated owner", async () => {
    const res = await request(app)
      .post(url(PARENT_A))
      .set("Cookie", cookieFor(PARENT_A))
      .send({ audio: AUDIO_DATA_URL, mimeType: "audio/webm" });

    expect(res.status).toBe(200);
    expect(res.body.text).toBe("transcribed text");
    expect(mocks.speechToText).toHaveBeenCalledTimes(1);
  });

  it("rejects unauthenticated requests with 401", async () => {
    const res = await request(app)
      .post(url(PARENT_A))
      .send({ audio: AUDIO_DATA_URL, mimeType: "audio/webm" });
    expect(res.status).toBe(401);
  });

  it("rejects cross-account access with 403", async () => {
    const res = await request(app)
      .post(url(PARENT_B))
      .set("Cookie", cookieFor(PARENT_A))
      .send({ audio: AUDIO_DATA_URL, mimeType: "audio/webm" });
    expect(res.status).toBe(403);
    expect(mocks.speechToText).not.toHaveBeenCalled();
  });

  it("returns 429 once the transcribe rate limit is exceeded", async () => {
    // The transcribe limiter allows 30; pre-fill the window so the next call trips it.
    await seedRateLimitAtLimit("parent-transcribe", PARENT_A, 60_000, 30);
    const res = await request(app)
      .post(url(PARENT_A))
      .set("Cookie", cookieFor(PARENT_A))
      .send({ audio: AUDIO_DATA_URL, mimeType: "audio/webm" });

    expect(res.status).toBe(429);
    expect(mocks.speechToText).not.toHaveBeenCalled();
  });
});

describe("GET /parent/:vidyaId/consultant/messages", () => {
  const url = (parent: string) => `/api/parent/${parent}/consultant/messages`;

  it("loads the authenticated owner's saved conversation", async () => {
    const res = await request(app).get(url(PARENT_A)).set("Cookie", cookieFor(PARENT_A));
    expect(res.status).toBe(200);
    expect(typeof res.body.sessionId).toBe("string");
    expect(Array.isArray(res.body.messages)).toBe(true);
  });

  it("rejects cross-account access with 403", async () => {
    const res = await request(app).get(url(PARENT_B)).set("Cookie", cookieFor(PARENT_A));
    expect(res.status).toBe(403);
  });
});
