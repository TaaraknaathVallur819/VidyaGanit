import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import request from "supertest";
const { randomId } = vi.hoisted(() => ({ randomId: vi.fn() }));
vi.mock("node:crypto", async (original) => ({
  ...(await original<typeof import("node:crypto")>()),
  randomInt: randomId,
}));
vi.mock("../lib/aiChat", async (original) => ({
  ...(await original<typeof import("../lib/aiChat")>()),
  streamChat: async function* () {
    yield "Consider this diagram. [[DRAW: A circle divided in half]]";
  },
}));
const diagram =
  "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxjaXJjbGUgY3g9IjUwIiBjeT0iNTAiIHI9IjQwIi8+PC9zdmc+";
vi.mock("../lib/aiImage", async (original) => ({
  ...(await original<typeof import("../lib/aiImage")>()),
  generateImageDataUrl: vi
    .fn()
    .mockResolvedValue(
      "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxjaXJjbGUgY3g9IjUwIiBjeT0iNTAiIHI9IjQwIi8+PC9zdmc+",
    ),
}));
import app from "../app";
import {
  db,
  pool,
  usersTable,
  chatMessagesTable,
  rateLimitBucketsTable,
} from "@workspace/db";
import { like } from "drizzle-orm";
import { signSession, SESSION_COOKIE } from "../lib/session";
const run = `QA_BUGFIX_${Date.now()}`;
const seedId = "VG-STU-98234";
let permitted = false;
let nextId = 98235;
const body = (suffix: string) => ({
  name: `${run}_${suffix}`,
  password: "QA!Disposable123456",
  role: "student",
  gender: "male",
  studentClass: "5",
  board: "CBSE",
});
const cookie = (id: string) => `${SESSION_COOKIE}=${signSession(id)}`;
beforeAll(async () => {
  if (
    new URL(process.env.DATABASE_URL!).hostname !==
    "ep-frosty-frost-b5nf26vp.c-7.us-east-2.aws.neon.tech"
  )
    throw new Error("These tests may run only on the disposable Neon branch");
  permitted = true;
  await db
    .insert(usersTable)
    .values({
      vidyaId: seedId,
      name: `${run}_seed`,
      passwordHash: "unused",
      role: "student",
      gender: "male",
      studentClass: "5",
      board: "CBSE",
    });
});
beforeEach(() => {
  randomId.mockReset().mockImplementation(() => nextId++);
});
afterAll(async () => {
  if (permitted) {
    await db
      .delete(rateLimitBucketsTable)
      .where(like(rateLimitBucketsTable.key, `%${seedId}%`));
    await db.delete(usersTable).where(like(usersTable.name, `${run}%`));
  }
  await pool.end();
});
describe("isolated database bug regressions", () => {
  it("allows exactly one account when the same username is submitted concurrently", async () => {
    const responses = await Promise.all(
      Array.from({ length: 5 }, () =>
        request(app).post("/api/auth/register").send(body("concurrent")),
      ),
    );
    expect(responses.map((response) => response.status).sort()).toEqual([
      201, 409, 409, 409, 409,
    ]);
  });
  it("retries a colliding Vidya ID and returns a successful session", async () => {
    randomId.mockReturnValueOnce(98234);
    const response = await request(app)
      .post("/api/auth/register")
      .send(body("collision"));
    expect(response.status).toBe(201);
    expect(response.body.vidyaId).not.toBe(seedId);
    expect(randomId).toHaveBeenCalledTimes(2);
    expect(String(response.headers["set-cookie"])).toContain("vg_session=");
  });
  it("returns a bounded retryable response if every generated ID collides", async () => {
    randomId.mockReturnValue(98234);
    const response = await request(app)
      .post("/api/auth/register")
      .send(body("exhausted"));
    expect(response.status).toBe(503);
    expect(randomId).toHaveBeenCalledTimes(5);
  });
  it("rejects a profile rename to an existing username cleanly", async () => {
    const registered = await request(app)
      .post("/api/auth/register")
      .send(body("rename"));
    expect(registered.status).toBe(201);
    const response = await request(app)
      .patch(`/api/profile/${registered.body.vidyaId}`)
      .set("Cookie", cookie(registered.body.vidyaId))
      .send({ name: `${run}_seed` });
    expect(response.status).toBe(409);
    expect(response.body.error).toContain("Username is taken");
  });
  it("persists the streamed diagram and restores it in an authorised history response", async () => {
    const sessionId = `${run}_diagram`;
    const response = await request(app)
      .post("/api/chat/message")
      .set("Cookie", cookie(seedId))
      .send({ vidyaId: seedId, message: "Please explain this shape", sessionId });
    expect(response.status).toBe(200);
    expect(response.text).toContain(diagram);
    const restored = await request(app)
      .get(`/api/chat/${seedId}/sessions/${sessionId}/messages`)
      .set("Cookie", cookie(seedId));
    expect(restored.status).toBe(200);
    const assistant = restored.body.messages.find(
      (message: { role: string }) => message.role === "assistant",
    );
    expect(assistant.imageUrl).toBe(diagram);
    expect(assistant.imageAlt).toBe("A circle divided in half");
  });
  it("keeps old text-only conversations readable and unauthenticated history protected", async () => {
    const sessionId = `${run}_legacy`;
    await db
      .insert(chatMessagesTable)
      .values({
        sessionId,
        studentVidyaId: seedId,
        role: "assistant",
        content: "Previous text-only answer",
      });
    const path = `/api/chat/${seedId}/sessions/${sessionId}/messages`;
    const response = await request(app).get(path).set("Cookie", cookie(seedId));
    expect(response.status).toBe(200);
    expect(response.body.messages[0].content).toBe("Previous text-only answer");
    expect(response.body.messages[0].imageUrl).toBeNull();
    expect((await request(app).get(path)).status).toBe(401);
  });
});
