import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";

import app from "../app";
import { signSession, SESSION_COOKIE } from "../lib/session";
import { db, usersTable, parentStudentLinksTable } from "@workspace/db";
import { inArray } from "drizzle-orm";

// Unique-per-run id prefix so test rows never collide with real data and are
// trivially identifiable for cleanup.
const RUN = `TST-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
const STUDENT_A = `${RUN}-STU-A`;
const STUDENT_B = `${RUN}-STU-B`;
const PARENT_A = `${RUN}-PARENT-A`;
const TUTOR_A = `${RUN}-TUTOR-A`;

const ALL_VIDYA_IDS = [STUDENT_A, STUDENT_B, PARENT_A, TUTOR_A];

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
    {
      vidyaId: PARENT_A,
      name: "Parent A",
      passwordHash: "x",
      role: "parent",
      gender: "female",
    },
    {
      vidyaId: TUTOR_A,
      name: "Tutor A",
      passwordHash: "x",
      role: "tutor",
      gender: "male",
    },
  ]);
});

afterAll(async () => {
  await db
    .delete(parentStudentLinksTable)
    .where(inArray(parentStudentLinksTable.parentVidyaId, ALL_VIDYA_IDS));
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

describe("GET /profile/:vidyaId/analytics (own progress)", () => {
  const url = (vidyaId: string) => `/api/profile/${vidyaId}/analytics`;

  it("returns the authenticated student's own analytics", async () => {
    const res = await request(app).get(url(STUDENT_A)).set("Cookie", cookieFor(STUDENT_A));

    expect(res.status).toBe(200);
    expect(res.body.studentVidyaId).toBe(STUDENT_A);
    expect(Array.isArray(res.body.topics)).toBe(true);
    expect(typeof res.body.totalSessions).toBe("number");
    expect(typeof res.body.totalMessages).toBe("number");
  });

  it("rejects unauthenticated requests with 401", async () => {
    const res = await request(app).get(url(STUDENT_A));
    expect(res.status).toBe(401);
  });

  it("rejects cross-account access with 403 (requireSelf)", async () => {
    // Logged in as A, asking for B's analytics.
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

describe("student linking is restricted to parents/tutors (requireParentOrTutor)", () => {
  const singleUrl = (vidyaId: string) => `/api/profile/${vidyaId}/link-student`;
  const bulkUrl = (vidyaId: string) => `/api/profile/${vidyaId}/link-students`;

  it("forbids a student from single-linking another student (403)", async () => {
    const res = await request(app)
      .post(singleUrl(STUDENT_A))
      .set("Cookie", cookieFor(STUDENT_A))
      .send({ studentVidyaId: STUDENT_B });
    expect(res.status).toBe(403);
  });

  it("forbids a student from bulk-linking students (403)", async () => {
    const res = await request(app)
      .post(bulkUrl(STUDENT_A))
      .set("Cookie", cookieFor(STUDENT_A))
      .send({ studentVidyaIds: [STUDENT_B] });
    expect(res.status).toBe(403);
  });

  it("lets a parent bulk-link a student with per-ID statuses", async () => {
    const res = await request(app)
      .post(bulkUrl(PARENT_A))
      .set("Cookie", cookieFor(PARENT_A))
      .send({ studentVidyaIds: [STUDENT_A, STUDENT_A, "VG-DOES-NOT-EXIST"] });
    expect(res.status).toBe(200);
    const byId = Object.fromEntries(
      res.body.results.map((r: { vidyaId: string; status: string }) => [r.vidyaId, r.status]),
    );
    expect(byId[STUDENT_A]).toBe("linked");
    expect(byId["VG-DOES-NOT-EXIST"]).toBe("not_found");
  });

  it("lets a tutor single-link a student with an optional batch", async () => {
    const res = await request(app)
      .post(singleUrl(TUTOR_A))
      .set("Cookie", cookieFor(TUTOR_A))
      .send({ studentVidyaId: STUDENT_B, batch: "Morning Batch" });
    expect(res.status).toBe(200);
    expect(res.body.vidyaId).toBe(STUDENT_B);
  });

  it("forbids a student from unlinking, but lets a parent unlink (requireParentOrTutor)", async () => {
    const unlinkUrl = (vidyaId: string, studentVidyaId: string) =>
      `/api/profile/${vidyaId}/link-student/${studentVidyaId}`;

    // Student cannot reach the unlink route at all.
    const studentRes = await request(app)
      .delete(unlinkUrl(STUDENT_A, STUDENT_B))
      .set("Cookie", cookieFor(STUDENT_A));
    expect(studentRes.status).toBe(403);

    // Parent (who linked STUDENT_A earlier) can unlink them.
    const parentRes = await request(app)
      .delete(unlinkUrl(PARENT_A, STUDENT_A))
      .set("Cookie", cookieFor(PARENT_A));
    expect(parentRes.status).toBe(200);
  });
});
