import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";

import app from "../app";
import { signSession, SESSION_COOKIE } from "../lib/session";
import { db, usersTable } from "@workspace/db";
import { inArray } from "drizzle-orm";

const RUN = `TST-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
const TUTOR = `${RUN}-TUTOR`;
const PARENT = `${RUN}-PARENT`;
const STUDENT = `${RUN}-STUDENT`;

const ALL_VIDYA_IDS = [TUTOR, PARENT, STUDENT];

function cookieFor(vidyaId: string): string {
  return `${SESSION_COOKIE}=${signSession(vidyaId)}`;
}

beforeAll(async () => {
  await db.insert(usersTable).values([
    { vidyaId: TUTOR, name: "Tutor", passwordHash: "x", role: "tutor", gender: "f" },
    { vidyaId: PARENT, name: "Parent", passwordHash: "x", role: "parent", gender: "m" },
    {
      vidyaId: STUDENT,
      name: "Student",
      passwordHash: "x",
      role: "student",
      gender: "m",
      studentClass: "5",
      board: "CBSE",
    },
  ]);
});

afterAll(async () => {
  await db.delete(usersTable).where(inArray(usersTable.vidyaId, ALL_VIDYA_IDS));
});

describe("GET /api/curriculum/:studentClass", () => {
  it("rejects unauthenticated requests with 401", async () => {
    const res = await request(app).get("/api/curriculum/5");
    expect(res.status).toBe(401);
  });

  it("returns the curriculum for a tutor", async () => {
    const res = await request(app)
      .get("/api/curriculum/5")
      .set("Cookie", cookieFor(TUTOR));
    expect(res.status).toBe(200);
    expect(res.body.studentClass).toBe("5");
    expect(Array.isArray(res.body.units)).toBe(true);
    expect(res.body.units.length).toBeGreaterThan(0);
  });

  it("denies a parent with 403", async () => {
    const res = await request(app)
      .get("/api/curriculum/5")
      .set("Cookie", cookieFor(PARENT));
    expect(res.status).toBe(403);
  });

  it("denies a student with 403", async () => {
    const res = await request(app)
      .get("/api/curriculum/5")
      .set("Cookie", cookieFor(STUDENT));
    expect(res.status).toBe(403);
  });

  it("rejects an unknown class for a tutor with 400", async () => {
    const res = await request(app)
      .get("/api/curriculum/9")
      .set("Cookie", cookieFor(TUTOR));
    expect(res.status).toBe(400);
  });
});
