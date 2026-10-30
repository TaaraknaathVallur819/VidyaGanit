import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

// No test in this file can reach a real database: `db` is replaced by a scripted
// fake, and the connection string below points nowhere.
const fake = vi.hoisted(() => {
  process.env.DATABASE_URL = "postgres://test:test@127.0.0.1:1/none";
  process.env.SESSION_SECRET = "test-session-secret";
  return { current: null as null | import("../lib/testDb").FakeDb };
});

vi.mock("@workspace/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@workspace/db")>();
  const { createFakeDb } = await import("../lib/testDb");
  fake.current = createFakeDb();
  return { ...actual, db: fake.current.db };
});
vi.mock("../lib/googleAi", () => ({
  gemini: { models: { generateContentStream: vi.fn(), generateContent: vi.fn() } },
}));
vi.mock("../lib/audio", () => ({ speechToText: vi.fn(), ensureCompatibleFormat: vi.fn() }));

import app from "../app";
import { signSession, SESSION_COOKIE } from "../lib/session";

const f = () => fake.current!;
const cookie = (id: string) => `${SESSION_COOKIE}=${signSession(id)}`;
const FUTURE = new Date(Date.now() + 86_400_000);
const PARENT = "VG-PAR-00001";
const TUTOR = "VG-TUT-00001";
const STUDENT = "VG-STU-00001";
const role = (r: string) => [{ role: r }];
const PARENT_PLAN = [{ planCode: "family_plus", currentEnd: FUTURE }];
const TUTOR_PLAN = [{ planCode: "tutor_pro", currentEnd: FUTURE }];
const studentRow = {
  vidyaId: STUDENT,
  name: "Kid",
  gender: "male",
  studentClass: "5",
  board: "CBSE",
  role: "student",
};
const sign = (payload: string, secret: string) =>
  createHmac("sha256", secret).update(payload).digest("hex");
const LEGACY_PUBLIC_SECRET = "dummy_razorpay_secret_vidyaganit_2026";

const RAZORPAY_ENV = [
  "RAZORPAY_KEY_ID",
  "RAZORPAY_KEY_SECRET",
  "RAZORPAY_WEBHOOK_SECRET",
  "RAZORPAY_MOCK",
  "PAYMENTS_DEMO_MODE",
  "SUPPORT_EMAIL",
] as const;

beforeEach(() => {
  f().reset();
  for (const k of RAZORPAY_ENV) delete process.env[k];
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("paid features are locked for free accounts (402)", () => {
  // `pre` is whatever each route's own middleware reads from the DB before the lock runs.
  const locked = [
    {
      name: "Strategy AI message (parent)",
      send: () => request(app).post(`/api/parent/${PARENT}/consultant/message`).send({ message: "hi" }),
      as: PARENT,
      role: "parent",
      pre: [] as unknown[][],
      plan: "family_plus",
    },
    {
      name: "AI Coach message (tutor)",
      send: () => request(app).post(`/api/parent/${TUTOR}/consultant/message`).send({ message: "hi" }),
      as: TUTOR,
      role: "tutor",
      pre: [],
      plan: "tutor_pro",
    },
    {
      name: "Strategy AI voice transcription",
      send: () => request(app).post(`/api/parent/${PARENT}/consultant/transcribe`).send({}),
      as: PARENT,
      role: "parent",
      pre: [],
      plan: "family_plus",
    },
    {
      name: "weekly digest",
      send: () => request(app).get(`/api/parent/${PARENT}/students/${STUDENT}/digest`),
      as: PARENT,
      role: "parent",
      pre: [],
      plan: "family_plus",
    },
    {
      name: "worksheets (parent)",
      send: () => request(app).post(`/api/worksheet/${PARENT}`).send({ topic: "fractions" }),
      as: PARENT,
      role: "parent",
      pre: [role("parent")],
      plan: "family_plus",
    },
    {
      name: "worksheets (tutor)",
      send: () => request(app).post(`/api/worksheet/${TUTOR}`).send({ topic: "fractions" }),
      as: TUTOR,
      role: "tutor",
      pre: [role("tutor")],
      plan: "tutor_pro",
    },
    {
      name: "class heatmap",
      send: () => request(app).get(`/api/tutor/${TUTOR}/heatmap`),
      as: TUTOR,
      role: "tutor",
      pre: [role("tutor")],
      plan: "tutor_pro",
    },
    {
      name: "worksheets targeted at the class weak spots",
      send: () => request(app).get(`/api/tutor/${TUTOR}/weak-topics`),
      as: TUTOR,
      role: "tutor",
      pre: [role("tutor")],
      plan: "tutor_pro",
    },
    {
      name: "connecting a payout account (online fee collection)",
      send: () =>
        request(app).patch(`/api/payments/${TUTOR}/route-account`).send({ accountId: "acc_ABC123" }),
      as: TUTOR,
      role: "tutor",
      pre: [role("tutor")],
      plan: "tutor_pro",
    },
  ];

  for (const c of locked) {
    it(`${c.name}`, async () => {
      f().queue.push(...c.pre, role(c.role), []);
      const res = await c.send().set("Cookie", cookie(c.as));
      expect(res.status).toBe(402);
      expect(res.body).toMatchObject({ code: "PLAN_REQUIRED", plan: c.plan });
    });
  }

  it("every locked route still rejects a logged-out caller with 401, not 402", async () => {
    for (const c of locked) {
      const res = await c.send();
      expect(res.status, c.name).toBe(401);
    }
  });

  it("a parent cannot use the tutor-only payout route (403, not an upsell)", async () => {
    f().queue.push(role("parent"));
    const res = await request(app)
      .patch(`/api/payments/${PARENT}/route-account`)
      .set("Cookie", cookie(PARENT))
      .send({ accountId: "acc_ABC123" });
    expect(res.status).toBe(403);
  });
});

describe("subscribers pass the lock", () => {
  it("a Family Plus parent can generate a worksheet", async () => {
    f().queue.push(role("parent"), role("parent"), PARENT_PLAN);
    const res = await request(app)
      .post(`/api/worksheet/${PARENT}`)
      .set("Cookie", cookie(PARENT))
      .send({ topic: "fractions", count: 5 });
    expect(res.status).toBe(200);
    expect(res.body.questions).toHaveLength(5);
  });

  it("a Tutor Pro tutor gets past the heatmap lock", async () => {
    f().queue.push(role("tutor"), role("tutor"), TUTOR_PLAN);
    const res = await request(app).get(`/api/tutor/${TUTOR}/heatmap`).set("Cookie", cookie(TUTOR));
    expect(res.status).not.toBe(402);
    expect(res.body?.code).not.toBe("PLAN_REQUIRED");
  });

  it("a Family Plus parent gets past the Strategy AI lock", async () => {
    f().queue.push(role("parent"), PARENT_PLAN);
    const res = await request(app)
      .post(`/api/parent/${PARENT}/consultant/message`)
      .set("Cookie", cookie(PARENT))
      .send({ message: "hi" });
    expect(res.status).not.toBe(402);
  });

  it("the other role's plan does not unlock it", async () => {
    f().queue.push(role("tutor"), role("tutor"), PARENT_PLAN);
    const res = await request(app).get(`/api/tutor/${TUTOR}/heatmap`).set("Cookie", cookie(TUTOR));
    expect(res.status).toBe(402);
  });
});

describe("report cards: a student always sees their own, adults need a plan", () => {
  const url = `/api/report-card/${STUDENT}`;

  it("locks a linked parent without a plan", async () => {
    f().queue.push([studentRow], role("parent"), []);
    const res = await request(app).get(url).set("Cookie", cookie(PARENT));
    expect(res.status).toBe(402);
    expect(res.body).toMatchObject({ code: "PLAN_REQUIRED", plan: "family_plus" });
  });

  it("still refuses an unlinked parent with 403 (not an upsell)", async () => {
    f().queue.push([]);
    const res = await request(app).get(url).set("Cookie", cookie(PARENT));
    expect(res.status).toBe(403);
    expect(res.body.code).toBeUndefined();
  });

  it("lets a linked subscriber through", async () => {
    f().queue.push([studentRow], role("parent"), PARENT_PLAN);
    const res = await request(app).get(url).set("Cookie", cookie(PARENT));
    expect(res.status).not.toBe(402);
  });

  it("never asks the student themselves to pay", async () => {
    const res = await request(app).get(url).set("Cookie", cookie(STUDENT));
    expect(res.status).not.toBe(402);
    expect(res.body?.code).not.toBe("PLAN_REQUIRED");
  });
});

describe("free parents may link one child", () => {
  const single = (id: string, body: object) =>
    request(app).post(`/api/profile/${id}/link-student`).set("Cookie", cookie(id)).send(body);
  const bulk = (id: string, body: object) =>
    request(app).post(`/api/profile/${id}/link-students`).set("Cookie", cookie(id)).send(body);

  it("allows the first child", async () => {
    f().queue.push(role("parent"), [studentRow], [], role("parent"), [{ count: 0 }], []);
    const res = await single(PARENT, { studentVidyaId: STUDENT });
    expect(res.status).toBe(200);
    expect(res.body.vidyaId).toBe(STUDENT);
  });

  it("blocks a second child without Family Plus", async () => {
    f().queue.push(role("parent"), [studentRow], [], role("parent"), [{ count: 1 }], []);
    const res = await single(PARENT, { studentVidyaId: STUDENT });
    expect(res.status).toBe(402);
    expect(res.body).toMatchObject({ code: "PLAN_REQUIRED", plan: "family_plus" });
    expect(f().inserts).toHaveLength(0);
  });

  it("allows a second child with Family Plus", async () => {
    f().queue.push(role("parent"), [studentRow], [], role("parent"), [{ count: 1 }], PARENT_PLAN, []);
    const res = await single(PARENT, { studentVidyaId: STUDENT });
    expect(res.status).toBe(200);
  });

  it("lets a free tutor link up to five students", async () => {
    f().queue.push(role("tutor"), [studentRow], [], role("tutor"), [{ count: 4 }], []);
    const res = await single(TUTOR, { studentVidyaId: STUDENT });
    expect(res.status).toBe(200);
  });

  it("blocks a free tutor's sixth student", async () => {
    f().queue.push(role("tutor"), [studentRow], [], role("tutor"), [{ count: 5 }], []);
    const res = await single(TUTOR, { studentVidyaId: STUDENT });
    expect(res.status).toBe(402);
    expect(res.body).toMatchObject({ plan: "tutor_pro", featureKey: "manyStudents" });
  });

  it("stops Family Plus at four children with a 409", async () => {
    f().queue.push(role("parent"), [studentRow], [], role("parent"), [{ count: 4 }], PARENT_PLAN);
    const res = await single(PARENT, { studentVidyaId: STUDENT });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe("LIMIT_REACHED");
  });

  it("blocks bulk-linking two real children for a free parent", async () => {
    f().queue.push(
      role("parent"),
      [],
      [{ vidyaId: "VG-STU-00001" }, { vidyaId: "VG-STU-00002" }],
      role("parent"),
      [{ count: 0 }],
      [],
    );
    const res = await bulk(PARENT, { studentVidyaIds: ["VG-STU-00001", "VG-STU-00002"] });
    expect(res.status).toBe(402);
    expect(res.body.code).toBe("PLAN_REQUIRED");
  });

  it("does not count a mistyped ID towards the limit", async () => {
    // Two IDs typed, only one is a real student: that is one new link, which is free.
    f().queue.push(role("parent"), [], [{ vidyaId: "VG-STU-00001" }], role("parent"), [{ count: 0 }]);
    const res = await bulk(PARENT, { studentVidyaIds: ["VG-STU-00001", "VG-TYPO"] });
    expect(res.status).not.toBe(402);
  });

  it("does not count a child who is already linked as a new one", async () => {
    f().queue.push(role("parent"), [{ studentVidyaId: "VG-STU-00001" }], role("parent"));
    const res = await bulk(PARENT, { studentVidyaIds: ["VG-STU-00001"] });
    // 0 new links, so the cap is never consulted: existing links are left alone.
    expect(res.status).not.toBe(402);
  });
});

describe("the payment gateway fails closed when Razorpay is not configured", () => {
  it("serves the public plan catalog", async () => {
    const res = await request(app).get("/api/payments/catalog");
    expect(res.status).toBe(200);
    expect(res.body.plans.map((p: { code: string }) => p.code)).toEqual(["family_plus", "tutor_pro"]);
  });

  it("answers 503 instead of creating a subscription", async () => {
    f().queue.push([{ role: "parent", name: "P" }], []);
    const res = await request(app)
      .post(`/api/payments/${PARENT}/subscriptions`)
      .set("Cookie", cookie(PARENT))
      .send({ planCode: "family_plus", billingCycle: "monthly" });
    expect(res.status).toBe(503);
    expect(res.body.code).toBe("PAYMENTS_UNAVAILABLE");
    expect(f().inserts).toHaveLength(0);
  });

  it("still reports plan status, flagged as payments-not-enabled and with no key", async () => {
    f().queue.push([{ role: "parent", routeAccountId: null, name: "P" }], [], []);
    const res = await request(app).get(`/api/payments/${PARENT}/status`).set("Cookie", cookie(PARENT));
    expect(res.status).toBe(200);
    expect(res.body.paymentsEnabled).toBe(false);
    expect(res.body.keyId).toBeNull();
    expect(res.body.plan).toBeNull();
  });

  it("rejects a subscription 'verified' with the old public dummy secret", async () => {
    const sig = sign("pay_1|sub_1", LEGACY_PUBLIC_SECRET);
    const res = await request(app)
      .post(`/api/payments/${PARENT}/subscriptions/verify`)
      .set("Cookie", cookie(PARENT))
      .send({ razorpay_payment_id: "pay_1", razorpay_subscription_id: "sub_1", razorpay_signature: sig });
    expect(res.status).toBe(400);
    expect(f().sets).toHaveLength(0);
  });

  it("rejects a webhook signed with the old public dummy secret", async () => {
    const body = JSON.stringify({
      event: "subscription.activated",
      payload: { subscription: { entity: { id: "sub_1" } } },
    });
    const res = await request(app)
      .post("/api/payments/webhook")
      .set("content-type", "application/json")
      .set("x-razorpay-signature", sign(body, LEGACY_PUBLIC_SECRET))
      .send(body);
    expect(res.status).toBe(400);
    expect(f().sets).toHaveLength(0);
  });

  it("rejects an unsigned webhook", async () => {
    const res = await request(app)
      .post("/api/payments/webhook")
      .set("content-type", "application/json")
      .send("{}");
    expect(res.status).toBe(400);
  });
});

describe("with real Razorpay credentials", () => {
  const fetchOk = (json: unknown) =>
    vi.fn(async () => ({ ok: true, status: 200, json: async () => json }));

  beforeEach(() => {
    process.env.RAZORPAY_KEY_ID = "rzp_test_realKeyId";
    process.env.RAZORPAY_KEY_SECRET = "real_key_secret";
    process.env.RAZORPAY_WEBHOOK_SECRET = "whsec_real";
  });

  const postWebhook = (payload: object) => {
    const body = JSON.stringify(payload);
    return request(app)
      .post("/api/payments/webhook")
      .set("content-type", "application/json")
      .set("x-razorpay-signature", sign(body, "whsec_real"))
      .send(body);
  };

  it("activates a subscription on a signed subscription.activated event", async () => {
    const res = await postWebhook({
      event: "subscription.activated",
      payload: {
        subscription: { entity: { id: "sub_1", current_start: 1_700_000_000, current_end: 1_702_592_000 } },
      },
    });
    expect(res.status).toBe(200);
    const set = f().sets[0] as { status?: string; currentEnd?: Date };
    expect(set.status).toBe("Success");
    expect(set.currentEnd).toEqual(new Date(1_702_592_000 * 1000));
  });

  it("leaves status and dates alone on unrelated events like subscription.updated", async () => {
    const res = await postWebhook({
      event: "subscription.updated",
      payload: { subscription: { entity: { id: "sub_1" } } },
    });
    expect(res.status).toBe(200);
    const set = f().sets[0] as Record<string, unknown>;
    expect(set).not.toHaveProperty("status");
    expect(set).not.toHaveProperty("currentEnd");
    expect(set).not.toHaveProperty("currentStart");
  });

  it("ends access on subscription.cancelled", async () => {
    await postWebhook({
      event: "subscription.cancelled",
      payload: { subscription: { entity: { id: "sub_1" } } },
    });
    expect((f().sets[0] as { status?: string }).status).toBe("Failed");
  });

  it("verifies a genuine subscription payment and gives a yearly plan a year", async () => {
    const fetchMock = fetchOk({ status: "authenticated", current_start: null, current_end: null });
    vi.stubGlobal("fetch", fetchMock);
    f().queue.push([{ billingCycle: "yearly" }], [{ id: 7 }]);
    const res = await request(app)
      .post(`/api/payments/${PARENT}/subscriptions/verify`)
      .set("Cookie", cookie(PARENT))
      .send({
        razorpay_payment_id: "pay_1",
        razorpay_subscription_id: "sub_1",
        razorpay_signature: sign("pay_1|sub_1", "real_key_secret"),
      });
    expect(res.status).toBe(200);
    const set = f().sets[0] as { status: string; currentEnd: Date };
    expect(set.status).toBe("Success");
    const days = (set.currentEnd.getTime() - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(364);
    expect(days).toBeLessThan(366);
  });

  it("gives a monthly plan about thirty days", async () => {
    vi.stubGlobal("fetch", fetchOk({ status: "authenticated" }));
    f().queue.push([{ billingCycle: "monthly" }], [{ id: 7 }]);
    await request(app)
      .post(`/api/payments/${PARENT}/subscriptions/verify`)
      .set("Cookie", cookie(PARENT))
      .send({
        razorpay_payment_id: "pay_1",
        razorpay_subscription_id: "sub_1",
        razorpay_signature: sign("pay_1|sub_1", "real_key_secret"),
      });
    const days = ((f().sets[0] as { currentEnd: Date }).currentEnd.getTime() - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(29);
    expect(days).toBeLessThan(31);
  });

  it("answers 404 for an unknown subscription without calling Razorpay", async () => {
    const fetchMock = fetchOk({});
    vi.stubGlobal("fetch", fetchMock);
    f().queue.push([]);
    const res = await request(app)
      .post(`/api/payments/${PARENT}/subscriptions/verify`)
      .set("Cookie", cookie(PARENT))
      .send({
        razorpay_payment_id: "pay_1",
        razorpay_subscription_id: "sub_nope",
        razorpay_signature: sign("pay_1|sub_nope", "real_key_secret"),
      });
    expect(res.status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("checks a fee payment with a body-less GET (a GET with a body throws in fetch)", async () => {
    const fetchMock = fetchOk({ id: "pay_1", order_id: "order_1", amount: 1000, status: "captured" });
    vi.stubGlobal("fetch", fetchMock);
    f().queue.push([{ id: 3, amountPaise: 1000, feePaymentId: 9 }]);
    const res = await request(app)
      .post(`/api/payments/${PARENT}/orders/order_1/verify`)
      .set("Cookie", cookie(PARENT))
      .send({ razorpay_payment_id: "pay_1", razorpay_signature: sign("order_1|pay_1", "real_key_secret") });
    expect(res.status).toBe(200);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain("/payments/pay_1");
    expect(init.body).toBeUndefined();
  });

  describe("online fee collection depends on the tutor's plan", () => {
    const feeRow = {
      id: 1,
      tutorVidyaId: TUTOR,
      studentVidyaId: STUDENT,
      amount: 500,
      period: "October",
      note: null,
      status: "unpaid",
      tutorName: "Tutor",
      routeAccountId: "acc_X",
    };

    it("offers online payment when the tutor has Tutor Pro", async () => {
      f().queue.push(role("parent"), [{ studentVidyaId: STUDENT }], [feeRow], [{ vidyaId: STUDENT, name: "Kid" }], TUTOR_PLAN);
      const res = await request(app).get(`/api/payments/${PARENT}/parent-fees`).set("Cookie", cookie(PARENT));
      expect(res.status).toBe(200);
      expect(res.body.fees[0].onlinePaymentAvailable).toBe(true);
    });

    it("hides online payment when the tutor has no plan", async () => {
      f().queue.push(role("parent"), [{ studentVidyaId: STUDENT }], [feeRow], [{ vidyaId: STUDENT, name: "Kid" }], []);
      const res = await request(app).get(`/api/payments/${PARENT}/parent-fees`).set("Cookie", cookie(PARENT));
      expect(res.body.fees[0].onlinePaymentAvailable).toBe(false);
    });

    it("refuses to open a Razorpay order for a tutor without a plan", async () => {
      const fetchMock = fetchOk({});
      vi.stubGlobal("fetch", fetchMock);
      f().queue.push([{ ...feeRow }], [{ id: 1 }], []);
      const res = await request(app)
        .post(`/api/payments/${PARENT}/parent-fees/1/order`)
        .set("Cookie", cookie(PARENT));
      expect(res.status).toBe(409);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });
});

describe("demo mode: a payment you can try end to end without real money", () => {
  const feeRow = {
    id: 1,
    tutorVidyaId: TUTOR,
    studentVidyaId: STUDENT,
    amount: 500,
    status: "unpaid",
    routeAccountId: "acc_X",
  };

  beforeEach(() => {
    process.env.PAYMENTS_DEMO_MODE = "true";
  });

  it("reports demo mode on the public catalog", async () => {
    const res = await request(app).get("/api/payments/catalog");
    expect(res.body.mode).toBe("demo");
  });

  it("creates a pending demo subscription with a recognisable demo plan id", async () => {
    f().queue.push([{ role: "parent", name: "P" }], []);
    const res = await request(app)
      .post(`/api/payments/${PARENT}/subscriptions`)
      .set("Cookie", cookie(PARENT))
      .send({ planCode: "family_plus", billingCycle: "monthly" });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ mode: "demo", keyId: "rzp_demo", amount: 100_000 });
    const row = f().inserts[0] as { providerPlanId: string; status: string; ownerVidyaId: string };
    expect(row).toMatchObject({
      providerPlanId: "demo_family_plus_monthly",
      status: "Pending",
      ownerVidyaId: PARENT,
    });
  });

  it("activates the plan for about a day when the demo checkout is confirmed", async () => {
    f().queue.push([{ id: 4 }]);
    const res = await request(app)
      .post(`/api/payments/${PARENT}/subscriptions/demo-confirm`)
      .set("Cookie", cookie(PARENT))
      .send({ subscriptionId: "sub_demo1" });
    expect(res.status).toBe(200);
    const set = f().sets[0] as { status: string; currentEnd: Date; providerPaymentId: string };
    expect(set.status).toBe("Success");
    expect(set.providerPaymentId).toMatch(/^pay_demo_/);
    const hours = (set.currentEnd.getTime() - Date.now()) / 3_600_000;
    expect(hours).toBeGreaterThan(23);
    expect(hours).toBeLessThan(25);
  });

  it("only confirms the callers own pending demo subscription", async () => {
    f().queue.push([]);
    const res = await request(app)
      .post(`/api/payments/${PARENT}/subscriptions/demo-confirm`)
      .set("Cookie", cookie(PARENT))
      .send({ subscriptionId: "sub_not_mine" });
    expect(res.status).toBe(404);
  });

  it("demo confirmation is a 404 when demo mode is off", async () => {
    delete process.env.PAYMENTS_DEMO_MODE;
    const res = await request(app)
      .post(`/api/payments/${PARENT}/subscriptions/demo-confirm`)
      .set("Cookie", cookie(PARENT))
      .send({ subscriptionId: "sub_demo1" });
    expect(res.status).toBe(404);
    expect(f().sets).toHaveLength(0);
  });

  it("still refuses forged signatures and unsigned webhooks", async () => {
    const sig = sign("pay_1|sub_1", "demo");
    const verify = await request(app)
      .post(`/api/payments/${PARENT}/subscriptions/verify`)
      .set("Cookie", cookie(PARENT))
      .send({ razorpay_payment_id: "pay_1", razorpay_subscription_id: "sub_1", razorpay_signature: sig });
    expect(verify.status).toBe(400);
    const hook = await request(app)
      .post("/api/payments/webhook")
      .set("content-type", "application/json")
      .set("x-razorpay-signature", sign("{}", "demo"))
      .send("{}");
    expect(hook.status).toBe(400);
  });

  it("lets a parent pay a tutor with Tutor Pro through the demo checkout", async () => {
    f().queue.push([feeRow], [{ id: 1 }], TUTOR_PLAN, []);
    const order = await request(app)
      .post(`/api/payments/${PARENT}/parent-fees/1/order`)
      .set("Cookie", cookie(PARENT));
    expect(order.status).toBe(201);
    expect(order.body.orderId).toMatch(/^order_/);

    f().reset();
    f().queue.push([{ id: 9, feePaymentId: 1 }]);
    const paid = await request(app)
      .post(`/api/payments/${PARENT}/orders/${order.body.orderId}/demo-confirm`)
      .set("Cookie", cookie(PARENT));
    expect(paid.status).toBe(200);
    // Order settled, and the fee is marked paid with a method the fee ledger accepts.
    expect(f().sets).toEqual([
      expect.objectContaining({ status: "Success" }),
      expect.objectContaining({ status: "paid", method: "other" }),
    ]);
  });

  it("shows the priority-support address only to Tutor Pro members", async () => {
    process.env.SUPPORT_EMAIL = "help@example.com";
    f().queue.push([{ role: "tutor", routeAccountId: null, name: "T" }], TUTOR_PLAN, []);
    const member = await request(app).get(`/api/payments/${TUTOR}/status`).set("Cookie", cookie(TUTOR));
    expect(member.body.supportEmail).toBe("help@example.com");

    f().queue.push([{ role: "tutor", routeAccountId: null, name: "T" }], [], []);
    const free = await request(app).get(`/api/payments/${TUTOR}/status`).set("Cookie", cookie(TUTOR));
    expect(free.body.supportEmail).toBeNull();

    // Priority support is advertised for Tutor Pro only, so Family Plus does not get it.
    f().queue.push([{ role: "parent", routeAccountId: null, name: "P" }], PARENT_PLAN, []);
    const parent = await request(app).get(`/api/payments/${PARENT}/status`).set("Cookie", cookie(PARENT));
    expect(parent.body.supportEmail).toBeNull();
  });

  it("reports the role, mode and plan the UI needs in one status call", async () => {
    f().queue.push([{ role: "parent", routeAccountId: null, name: "P" }], PARENT_PLAN, []);
    const res = await request(app).get(`/api/payments/${PARENT}/status`).set("Cookie", cookie(PARENT));
    expect(res.body).toMatchObject({ role: "parent", mode: "demo", paymentsEnabled: true, keyId: "rzp_demo" });
    expect(res.body.plan.code).toBe("family_plus");
  });
});

describe("a fee paid through real Razorpay is recorded with an allowed ledger method", () => {
  it("maps the Razorpay payment method onto the fee ledger enum", async () => {
    process.env.RAZORPAY_KEY_ID = "rzp_test_realKeyId";
    process.env.RAZORPAY_KEY_SECRET = "real_key_secret";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          id: "pay_1",
          order_id: "order_1",
          amount: 1000,
          status: "captured",
          method: "netbanking",
        }),
      })),
    );
    f().queue.push([{ id: 3, amountPaise: 1000, feePaymentId: 9 }]);
    const res = await request(app)
      .post(`/api/payments/${PARENT}/orders/order_1/verify`)
      .set("Cookie", cookie(PARENT))
      .send({ razorpay_payment_id: "pay_1", razorpay_signature: sign("order_1|pay_1", "real_key_secret") });
    expect(res.status).toBe(200);
    // "razorpay" is not an allowed method and would make the whole tutor fee list fail to load.
    expect(f().sets[1]).toMatchObject({ status: "paid", method: "bank_transfer" });
  });
});

describe("free students get a few games a day", () => {
  const studentUser = { vidyaId: STUDENT, role: "student", xp: 10, coins: 5, badges: [] };
  const score = () =>
    request(app)
      .post("/api/games/score")
      .set("Cookie", cookie(STUDENT))
      .send({ vidyaId: STUDENT, game: "speed", score: 4 });
  // The two rate-limit middlewares each take one scripted answer before the handler runs.
  const limiters = [[{ count: 1 }], [{ count: 1 }]];

  it("counts a game against the allowance and rewards it", async () => {
    f().queue.push(...limiters, [studentUser], [], [{ count: 3 }]);
    const res = await score();
    expect(res.status).toBe(200);
    expect(res.body.xpAwarded).toBe(4);
  });

  it("refuses the game after the daily allowance and says who can fix it", async () => {
    f().queue.push(...limiters, [studentUser], [], [{ count: 6 }]);
    const res = await score();
    expect(res.status).toBe(402);
    expect(res.body).toMatchObject({ code: "PLAN_REQUIRED", featureKey: "games", audience: "student" });
    expect(f().sets).toHaveLength(0);
  });

  it("is unlimited for a student whose linked parent has Family Plus", async () => {
    f().queue.push(...limiters, [studentUser], [{ ownerVidyaId: PARENT, role: "parent" }], PARENT_PLAN);
    const res = await score();
    expect(res.status).toBe(200);
  });

  it("reports the remaining free games before a game starts", async () => {
    f().queue.push([], [{ count: 2 }]);
    const res = await request(app).get("/api/games/allowance").set("Cookie", cookie(STUDENT));
    expect(res.body).toEqual({ unlimited: false, limit: 5, used: 2, remaining: 3 });
  });

  it("reports unlimited for a student with a paying adult", async () => {
    f().queue.push([{ ownerVidyaId: TUTOR, role: "tutor" }], TUTOR_PLAN);
    const res = await request(app).get("/api/games/allowance").set("Cookie", cookie(STUDENT));
    expect(res.body.unlimited).toBe(true);
  });
});

describe("worksheets targeted at the class weak spots", () => {
  it("returns the three lowest-scoring topics, weakest first", async () => {
    const attempt = (student: string, topic: string, label: string, score: number) => ({
      studentVidyaId: student,
      topic,
      topicLabel: label,
      score,
      totalQuestions: 10,
      pointsPerCorrect: 1,
    });
    f().queue.push(
      role("tutor"),
      role("tutor"),
      TUTOR_PLAN,
      [
        { studentVidyaId: "S1", batch: null, name: "A" },
        { studentVidyaId: "S2", batch: null, name: "B" },
      ],
      [
        attempt("S1", "fractions", "Fractions", 4),
        attempt("S1", "fractions", "Fractions", 2), // best score per student counts, not the latest
        attempt("S2", "fractions", "Fractions", 2),
        attempt("S1", "decimals", "Decimals", 8),
        attempt("S1", "geometry", "Geometry", 6),
        attempt("S2", "geometry", "Geometry", 6),
        attempt("S1", "algebra", "Algebra", 9),
      ],
    );
    const res = await request(app).get(`/api/tutor/${TUTOR}/weak-topics`).set("Cookie", cookie(TUTOR));
    expect(res.status).toBe(200);
    expect(res.body.topics).toEqual([
      { topic: "fractions", label: "Fractions", averagePercent: 30, students: 2 },
      { topic: "geometry", label: "Geometry", averagePercent: 60, students: 2 },
      { topic: "decimals", label: "Decimals", averagePercent: 80, students: 1 },
    ]);
  });

  it("returns an empty list for a class with no graded tests", async () => {
    f().queue.push(role("tutor"), role("tutor"), TUTOR_PLAN, [], []);
    const res = await request(app).get(`/api/tutor/${TUTOR}/weak-topics`).set("Cookie", cookie(TUTOR));
    expect(res.body.topics).toEqual([]);
  });
});
