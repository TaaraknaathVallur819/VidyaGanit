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
    { vidyaId: TUTOR, name: "Tutor", passwordHash: "x", role: "tutor", gender: "f", batch: "A" },
    { vidyaId: PARENT, name: "Parent", passwordHash: "x", role: "parent", gender: "m", batch: "A" },
    {
      vidyaId: STUDENT,
      name: "Student",
      passwordHash: "x",
      role: "student",
      gender: "m",
      studentClass: "5",
      board: "CBSE",
      batch: "A",
    },
  ]);
});

afterAll(async () => {
  await db.delete(usersTable).where(inArray(usersTable.vidyaId, ALL_VIDYA_IDS));
});

describe("student-only gating (duels)", () => {
  it("rejects unauthenticated duel listing with 401", async () => {
    const res = await request(app).get(`/api/duels/${STUDENT}`);
    expect(res.status).toBe(401);
  });

  it("allows a student to list their duels", async () => {
    const res = await request(app)
      .get(`/api/duels/${STUDENT}`)
      .set("Cookie", cookieFor(STUDENT));
    expect(res.status).toBe(200);
  });

  it("denies a tutor from listing duels with 403", async () => {
    const res = await request(app)
      .get(`/api/duels/${TUTOR}`)
      .set("Cookie", cookieFor(TUTOR));
    expect(res.status).toBe(403);
  });

  it("denies a parent from listing duels with 403", async () => {
    const res = await request(app)
      .get(`/api/duels/${PARENT}`)
      .set("Cookie", cookieFor(PARENT));
    expect(res.status).toBe(403);
  });

  it("denies a tutor from creating a duel with 403", async () => {
    const res = await request(app)
      .post(`/api/duels/${TUTOR}/challenge`)
      .set("Cookie", cookieFor(TUTOR))
      .send({ opponentVidyaId: STUDENT });
    expect(res.status).toBe(403);
  });
});

describe("student-only gating (mock exam)", () => {
  it("allows a student to read mock exam history", async () => {
    const res = await request(app)
      .get(`/api/mock-exam/${STUDENT}/history`)
      .set("Cookie", cookieFor(STUDENT));
    expect(res.status).toBe(200);
  });

  it("denies a tutor from starting a mock exam with 403", async () => {
    const res = await request(app)
      .post(`/api/mock-exam/${TUTOR}/start`)
      .set("Cookie", cookieFor(TUTOR))
      .send({});
    expect(res.status).toBe(403);
  });

  it("denies a parent from reading mock exam history with 403", async () => {
    const res = await request(app)
      .get(`/api/mock-exam/${PARENT}/history`)
      .set("Cookie", cookieFor(PARENT));
    expect(res.status).toBe(403);
  });
});
