import { beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";
import { PgDialect } from "drizzle-orm/pg-core";

const fake = vi.hoisted(() => {
  // Never let a unit test reach a real database.
  process.env.DATABASE_URL = "postgres://test:test@127.0.0.1:1/none";
  process.env.SESSION_SECRET = "test-session-secret";
  return { current: null as null | import("./testDb").FakeDb };
});

vi.mock("@workspace/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@workspace/db")>();
  const { createFakeDb } = await import("./testDb");
  fake.current = createFakeDb();
  return { ...actual, db: fake.current.db };
});

import {
  FREE_LIMITS,
  PAID_LIMITS,
  activePlan,
  childLinkDenial,
  planDenial,
  planForRole,
  requirePlan,
} from "./planAccess";

const f = () => fake.current!;
const dialect = new PgDialect();
const FUTURE = new Date(Date.now() + 86_400_000);

beforeEach(() => {
  f().reset();
  delete process.env.RAZORPAY_MOCK;
  delete process.env.PAYMENTS_DEMO_MODE;
  delete process.env.RAZORPAY_KEY_ID;
  delete process.env.RAZORPAY_KEY_SECRET;
});

describe("activePlan", () => {
  it("returns null when the owner has no qualifying subscription", async () => {
    f().queue.push([]);
    expect(await activePlan("VG-PAR-1")).toBeNull();
  });

  it("returns the plan when one qualifies", async () => {
    f().queue.push([{ planCode: "family_plus", currentEnd: FUTURE }]);
    expect(await activePlan("VG-PAR-1")).toEqual({ planCode: "family_plus", currentEnd: FUTURE });
  });

  it("only trusts successful, unexpired, non-placeholder subscriptions", async () => {
    f().queue.push([]);
    await activePlan("VG-PAR-1");
    const { sql, params } = dialect.sqlToQuery(f().wheres[0] as never);

    // "Success" is what the verify route and webhook write; "active"/"authenticated"
    // are never written and must not grant access.
    expect(params).toContain("Success");
    expect(params).not.toContain("active");
    expect(params).not.toContain("authenticated");
    // Access ends when the period ends (a missing end date grants nothing).
    expect(sql).toMatch(/"current_end" > \$/);
    // Rows made without a real payment carry placeholder plan ids and never count.
    expect(sql).toMatch(/"provider_plan_id" not in \(/);
    expect(params).toEqual(
      expect.arrayContaining([
        "plan_family_plus_monthly",
        "plan_family_plus_yearly",
        "plan_tutor_pro_monthly",
        "plan_tutor_pro_yearly",
      ]),
    );
  });

  it("drops the placeholder exclusion only in explicit mock mode", async () => {
    process.env.RAZORPAY_MOCK = "true";
    f().queue.push([]);
    await activePlan("VG-PAR-1");
    const { sql } = dialect.sqlToQuery(f().wheres[0] as never);
    expect(sql).not.toMatch(/"provider_plan_id" not in/);
  });

  it("ignores demo subscriptions unless demo mode is on", async () => {
    f().queue.push([]);
    await activePlan("VG-PAR-1");
    const off = dialect.sqlToQuery(f().wheres[0] as never);
    expect(off.sql).toMatch(/"provider_plan_id" not like \$/);
    expect(off.params).toContain("demo\\_%");

    process.env.PAYMENTS_DEMO_MODE = "true";
    f().queue.push([]);
    await activePlan("VG-PAR-1");
    const on = dialect.sqlToQuery(f().wheres[1] as never);
    expect(on.sql).not.toMatch(/not like/);
  });

  it("stops counting demo subscriptions the moment real keys are added", async () => {
    process.env.PAYMENTS_DEMO_MODE = "true";
    process.env.RAZORPAY_KEY_ID = "rzp_test_x";
    process.env.RAZORPAY_KEY_SECRET = "secret";
    f().queue.push([]);
    await activePlan("VG-PAR-1");
    expect(dialect.sqlToQuery(f().wheres[0] as never).sql).toMatch(/not like/);
  });
});

describe("planForRole", () => {
  it("maps parents and tutors to their plan and nobody else", () => {
    expect(planForRole("parent")).toBe("family_plus");
    expect(planForRole("tutor")).toBe("tutor_pro");
    expect(planForRole("student")).toBeNull();
    expect(planForRole(undefined)).toBeNull();
  });
});

describe("planDenial", () => {
  it("denies a parent with no plan (402, Family Plus)", async () => {
    f().queue.push([{ role: "parent" }], []);
    const denial = await planDenial("VG-PAR-1", "advisor");
    expect(denial?.status).toBe(402);
    expect(denial?.body).toMatchObject({
      code: "PLAN_REQUIRED",
      plan: "family_plus",
      feature: "Strategy AI",
      featureKey: "advisor",
    });
    expect(denial?.body.error).toContain("Family Plus");
  });

  it("names the same feature differently for a tutor (AI Coach)", async () => {
    f().queue.push([{ role: "tutor" }], []);
    const denial = await planDenial("VG-TUT-1", "advisor");
    expect(denial?.body).toMatchObject({ plan: "tutor_pro", feature: "The AI Coach", featureKey: "advisor" });
  });

  it("allows a parent with Family Plus", async () => {
    f().queue.push([{ role: "parent" }], [{ planCode: "family_plus", currentEnd: FUTURE }]);
    expect(await planDenial("VG-PAR-1", "advisor")).toBeNull();
  });

  it("denies a tutor with no plan (402, Tutor Pro)", async () => {
    f().queue.push([{ role: "tutor" }], []);
    const denial = await planDenial("VG-TUT-1", "heatmap");
    expect(denial?.status).toBe(402);
    expect(denial?.body.plan).toBe("tutor_pro");
  });

  it("does not let the other role's plan unlock a feature", async () => {
    f().queue.push([{ role: "tutor" }], [{ planCode: "family_plus", currentEnd: FUTURE }]);
    expect((await planDenial("VG-TUT-1", "heatmap"))?.status).toBe(402);
  });

  it("refuses a feature that does not exist for the caller's role (403)", async () => {
    f().queue.push([{ role: "parent" }]);
    expect((await planDenial("VG-PAR-1", "heatmap"))?.status).toBe(403);
  });

  it("refuses students and unknown accounts outright (403)", async () => {
    f().queue.push([{ role: "student" }]);
    expect((await planDenial("VG-STU-1", "advisor"))?.status).toBe(403);
    f().queue.push([]);
    expect((await planDenial("VG-NOPE", "advisor"))?.status).toBe(403);
  });
});

describe("requirePlan middleware", () => {
  function appFor(vidyaId: string | undefined) {
    const app = express();
    app.use((req, _res, next) => {
      req.vidyaId = vidyaId;
      next();
    });
    app.get("/locked", requirePlan("worksheets"), (_req, res) => {
      res.json({ ok: true });
    });
    return app;
  }

  it("answers 402 with a machine-readable body and never runs the handler", async () => {
    f().queue.push([{ role: "parent" }], []);
    const res = await request(appFor("VG-PAR-1")).get("/locked");
    expect(res.status).toBe(402);
    expect(res.body).toMatchObject({
      code: "PLAN_REQUIRED",
      plan: "family_plus",
      feature: "Personalised worksheets",
      featureKey: "worksheets",
    });
  });

  it("lets a subscriber through", async () => {
    f().queue.push([{ role: "parent" }], [{ planCode: "family_plus", currentEnd: FUTURE }]);
    const res = await request(appFor("VG-PAR-1")).get("/locked");
    expect(res.status).toBe(200);
  });

  it("answers 401 when there is no session", async () => {
    const res = await request(appFor(undefined)).get("/locked");
    expect(res.status).toBe(401);
  });
});

describe("childLinkDenial: how many children / students an account may link", () => {
  const parentPlan = [{ planCode: "family_plus", currentEnd: FUTURE }];
  const tutorPlan = [{ planCode: "tutor_pro", currentEnd: FUTURE }];

  it("lets a free parent link their first child", async () => {
    f().queue.push([{ role: "parent" }], [{ count: 0 }]);
    expect(await childLinkDenial("VG-PAR-1", 1)).toBeNull();
  });

  it("blocks a free parent's second child (402, Family Plus)", async () => {
    f().queue.push([{ role: "parent" }], [{ count: FREE_LIMITS.parentChildren }], []);
    const denial = await childLinkDenial("VG-PAR-1", 1);
    expect(denial?.status).toBe(402);
    expect(denial?.body).toMatchObject({ code: "PLAN_REQUIRED", plan: "family_plus", featureKey: "manyChildren" });
  });

  it("blocks linking two children at once for a free parent", async () => {
    f().queue.push([{ role: "parent" }], [{ count: 0 }], []);
    expect((await childLinkDenial("VG-PAR-1", 2))?.status).toBe(402);
  });

  it("lets Family Plus link up to four children", async () => {
    f().queue.push([{ role: "parent" }], [{ count: PAID_LIMITS.parentChildren - 1 }], parentPlan);
    expect(await childLinkDenial("VG-PAR-1", 1)).toBeNull();
  });

  it("stops Family Plus at four children (409, not an upsell)", async () => {
    f().queue.push([{ role: "parent" }], [{ count: PAID_LIMITS.parentChildren }], parentPlan);
    const denial = await childLinkDenial("VG-PAR-1", 1);
    expect(denial?.status).toBe(409);
    expect(denial?.body.code).toBe("LIMIT_REACHED");
  });

  it("never blocks adding nothing, so existing links stay untouched", async () => {
    expect(await childLinkDenial("VG-PAR-1", 0)).toBeNull();
  });

  it("lets a free tutor link up to five students", async () => {
    f().queue.push([{ role: "tutor" }], [{ count: FREE_LIMITS.tutorStudents - 1 }]);
    expect(await childLinkDenial("VG-TUT-1", 1)).toBeNull();
  });

  it("blocks a free tutor's sixth student (402, Tutor Pro)", async () => {
    f().queue.push([{ role: "tutor" }], [{ count: FREE_LIMITS.tutorStudents }], []);
    const denial = await childLinkDenial("VG-TUT-1", 1);
    expect(denial?.status).toBe(402);
    expect(denial?.body).toMatchObject({ plan: "tutor_pro", featureKey: "manyStudents" });
  });

  it("lets Tutor Pro link any number of students", async () => {
    f().queue.push([{ role: "tutor" }], [{ count: 400 }], tutorPlan);
    expect(await childLinkDenial("VG-TUT-1", 25)).toBeNull();
  });

  it("ignores accounts that are neither parents nor tutors", async () => {
    f().queue.push([{ role: "student" }]);
    expect(await childLinkDenial("VG-STU-1", 3)).toBeNull();
  });
});
