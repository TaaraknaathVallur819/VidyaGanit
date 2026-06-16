import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";

import app from "../app";
import { signSession, SESSION_COOKIE } from "../lib/session";
import { db, usersTable } from "@workspace/db";
import { inArray } from "drizzle-orm";

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
  await db.delete(usersTable).where(inArray(usersTable.vidyaId, ALL_VIDYA_IDS));
});

describe("GET /profile/:vidyaId", () => {
  const url = (vidyaId: string) => `/api/profile/${vidyaId}`;

  it("returns the authenticated owner's own profile", async () => {
    const res = await request(app).get(url(STUDENT_A)).set("Cookie", cookieFor(STUDENT_A));

    expect(res.status).toBe(200);
    expect(res.body.vidyaId).toBe(STUDENT_A);
    expect(res.body.name).toBe("Student A");
    expect(res.body.role).toBe("student");
  });

  it("rejects unauthenticated requests with 401", async () => {
    const res = await request(app).get(url(STUDENT_A));
    expect(res.status).toBe(401);
  });

  it("rejects cross-account access with 403 (requireSelf)", async () => {
    // Logged in as A, asking for B's profile.
    const res = await request(app).get(url(STUDENT_B)).set("Cookie", cookieFor(STUDENT_A));
    expect(res.status).toBe(403);
  });
});

describe("PATCH /profile/:vidyaId", () => {
  const url = (vidyaId: string) => `/api/profile/${vidyaId}`;

  it("lets the authenticated owner update their own profile", async () => {
    const res = await request(app)
      .patch(url(STUDENT_A))
      .set("Cookie", cookieFor(STUDENT_A))
      .send({ language: "hi" });

    expect(res.status).toBe(200);
    expect(res.body.vidyaId).toBe(STUDENT_A);
    expect(res.body.language).toBe("hi");
  });

  it("rejects cross-account updates with 403 (requireSelf)", async () => {
    // Logged in as A, trying to modify B's profile.
    const res = await request(app)
      .patch(url(STUDENT_B))
      .set("Cookie", cookieFor(STUDENT_A))
      .send({ language: "ta" });
    expect(res.status).toBe(403);
  });
});
