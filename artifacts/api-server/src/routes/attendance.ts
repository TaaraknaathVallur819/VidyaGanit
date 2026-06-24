import { Router, type IRouter } from "express";
import { and, desc, eq } from "drizzle-orm";
import { db, usersTable, attendanceTable, parentStudentLinksTable } from "@workspace/db";
import {
  GetTutorAttendanceParams,
  GetTutorAttendanceResponse,
  MarkAttendanceParams,
  MarkAttendanceBody,
  MarkAttendanceResponse,
  GetStudentAttendanceParams,
  GetStudentAttendanceResponse,
} from "@workspace/api-zod";
import { requireAuth, requireSelf, requireTutor } from "../middlewares/auth";
import { getLinkedStudentFor } from "../lib/links";

const router: IRouter = Router();

/** Students linked to this tutor, with their batch + display name. */
async function tutorStudents(tutorVidyaId: string) {
  return db
    .select({
      studentVidyaId: parentStudentLinksTable.studentVidyaId,
      batch: parentStudentLinksTable.batch,
      name: usersTable.name,
    })
    .from(parentStudentLinksTable)
    .innerJoin(usersTable, eq(usersTable.vidyaId, parentStudentLinksTable.studentVidyaId))
    .where(eq(parentStudentLinksTable.parentVidyaId, tutorVidyaId));
}

function tally(rows: { status: string }[]) {
  let present = 0;
  let absent = 0;
  let late = 0;
  for (const r of rows) {
    if (r.status === "present") present += 1;
    else if (r.status === "absent") absent += 1;
    else if (r.status === "late") late += 1;
  }
  const total = present + absent + late;
  // "Late" counts as a half-attended session for the percentage.
  const attendancePct = total === 0 ? 0 : Math.round(((present + late * 0.5) / total) * 100);
  return { present, absent, late, total, attendancePct };
}

/** Build the tutor's attendance payload: all records + per-student summary. */
async function tutorPayload(tutorVidyaId: string) {
  const students = await tutorStudents(tutorVidyaId);
  const nameMap = new Map(students.map((s) => [s.studentVidyaId, s.name]));

  const rows = await db
    .select()
    .from(attendanceTable)
    .where(eq(attendanceTable.tutorVidyaId, tutorVidyaId))
    .orderBy(desc(attendanceTable.sessionDate), desc(attendanceTable.id));

  const records = rows.map((r) => ({
    id: r.id,
    studentVidyaId: r.studentVidyaId,
    studentName: nameMap.get(r.studentVidyaId) ?? r.studentVidyaId,
    sessionDate: r.sessionDate,
    status: r.status,
    note: r.note ?? null,
    createdAt: r.createdAt.toISOString(),
  }));

  const summaries = students.map((s) => {
    const own = records.filter((r) => r.studentVidyaId === s.studentVidyaId);
    return {
      studentVidyaId: s.studentVidyaId,
      name: s.name,
      batch: s.batch ?? null,
      ...tally(own),
    };
  });

  return { records, summaries };
}

router.get(
  "/tutor/:vidyaId/attendance",
  requireAuth,
  requireSelf,
  requireTutor,
  async (req, res): Promise<void> => {
    const params = GetTutorAttendanceParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    res.json(GetTutorAttendanceResponse.parse(await tutorPayload(params.data.vidyaId)));
  },
);

router.post(
  "/tutor/:vidyaId/attendance",
  requireAuth,
  requireSelf,
  requireTutor,
  async (req, res): Promise<void> => {
    const params = MarkAttendanceParams.safeParse(req.params);
    const body = MarkAttendanceBody.safeParse(req.body);
    if (!params.success || !body.success) {
      res.status(400).json({ error: "Invalid input" });
      return;
    }

    const linked = await getLinkedStudentFor(params.data.vidyaId, body.data.studentVidyaId);
    if (!linked) {
      res.status(404).json({ error: "Student not linked to this tutor" });
      return;
    }

    // Upsert: re-marking the same (tutor, student, date) updates the row.
    await db
      .insert(attendanceTable)
      .values({
        tutorVidyaId: params.data.vidyaId,
        studentVidyaId: body.data.studentVidyaId,
        sessionDate: body.data.sessionDate,
        status: body.data.status,
        note: body.data.note ?? null,
      })
      .onConflictDoUpdate({
        target: [
          attendanceTable.tutorVidyaId,
          attendanceTable.studentVidyaId,
          attendanceTable.sessionDate,
        ],
        set: { status: body.data.status, note: body.data.note ?? null },
      });

    res.json(MarkAttendanceResponse.parse(await tutorPayload(params.data.vidyaId)));
  },
);

router.get(
  "/parent/:vidyaId/students/:studentVidyaId/attendance",
  requireAuth,
  requireSelf,
  async (req, res): Promise<void> => {
    const params = GetStudentAttendanceParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const linked = await getLinkedStudentFor(params.data.vidyaId, params.data.studentVidyaId);
    if (!linked) {
      res.status(404).json({ error: "Student not linked" });
      return;
    }

    const rows = await db
      .select()
      .from(attendanceTable)
      .where(eq(attendanceTable.studentVidyaId, params.data.studentVidyaId))
      .orderBy(desc(attendanceTable.sessionDate), desc(attendanceTable.id));

    const records = rows.map((r) => ({
      id: r.id,
      studentVidyaId: r.studentVidyaId,
      studentName: linked.name,
      sessionDate: r.sessionDate,
      status: r.status,
      note: r.note ?? null,
      createdAt: r.createdAt.toISOString(),
    }));

    res.json(
      GetStudentAttendanceResponse.parse({
        records,
        summary: {
          studentVidyaId: params.data.studentVidyaId,
          name: linked.name,
          batch: null,
          ...tally(records),
        },
      }),
    );
  },
);

export default router;
