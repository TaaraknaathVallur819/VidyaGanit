import { Router, type IRouter } from "express";
import { and, desc, eq } from "drizzle-orm";
import {
  db,
  usersTable,
  feePaymentsTable,
  parentStudentLinksTable,
  directMessagesTable,
} from "@workspace/db";
import {
  GetTutorFeesParams,
  GetTutorFeesResponse,
  RecordFeePaymentParams,
  RecordFeePaymentBody,
  RecordFeePaymentResponse,
  DeleteFeePaymentParams,
  DeleteFeePaymentResponse,
  SendFeeRemindersParams,
  SendFeeRemindersBody,
  SendFeeRemindersResponse,
} from "@workspace/api-zod";
import { requireAuth, requireSelf, requireTutor } from "../middlewares/auth";
import { getLinkedStudentFor, linkedParentsOfStudent } from "../lib/links";
import { createNotification } from "../lib/notify";
import { rateLimit } from "../middlewares/rateLimit";

const router: IRouter = Router();

/** Students linked to this tutor, with the batch the tutor assigned them to. */
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

/**
 * Build the fee response for a tutor: the full record list (newest first) plus a
 * per-student summary (latest status + total paid) covering every linked student,
 * so the tutor can see who has and hasn't paid.
 */
async function feesPayload(tutorVidyaId: string) {
  const rows = await db
    .select()
    .from(feePaymentsTable)
    .where(eq(feePaymentsTable.tutorVidyaId, tutorVidyaId))
    .orderBy(desc(feePaymentsTable.createdAt), desc(feePaymentsTable.id));

  const students = await tutorStudents(tutorVidyaId);
  const nameMap = new Map(students.map((s) => [s.studentVidyaId, s.name]));

  const records = rows.map((r) => ({
    id: r.id,
    studentVidyaId: r.studentVidyaId,
    studentName: nameMap.get(r.studentVidyaId) ?? r.studentVidyaId,
    amount: r.amount,
    method: r.method,
    status: r.status,
    period: r.period ?? null,
    note: r.note ?? null,
    paidOn: r.paidOn ?? null,
    createdAt: r.createdAt.toISOString(),
  }));

  // `records` is newest-first, so the first row seen per student is the latest.
  const latestByStudent = new Map<string, (typeof records)[number]>();
  const totalByStudent = new Map<string, number>();
  for (const rec of records) {
    if (!latestByStudent.has(rec.studentVidyaId)) {
      latestByStudent.set(rec.studentVidyaId, rec);
    }
    if (rec.status === "paid") {
      totalByStudent.set(
        rec.studentVidyaId,
        (totalByStudent.get(rec.studentVidyaId) ?? 0) + rec.amount,
      );
    }
  }

  const summaries = students.map((s) => {
    const latest = latestByStudent.get(s.studentVidyaId);
    return {
      studentVidyaId: s.studentVidyaId,
      name: s.name,
      batch: s.batch ?? null,
      latestStatus: latest?.status ?? null,
      latestAmount: latest?.amount ?? null,
      latestMethod: latest?.method ?? null,
      latestPaidOn: latest?.paidOn ?? null,
      totalPaid: totalByStudent.get(s.studentVidyaId) ?? 0,
    };
  });

  return { records, summaries };
}

router.get(
  "/tutor/:vidyaId/fees",
  requireAuth,
  requireSelf,
  requireTutor,
  async (req, res): Promise<void> => {
    const params = GetTutorFeesParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    res.json(GetTutorFeesResponse.parse(await feesPayload(params.data.vidyaId)));
  },
);

router.post(
  "/tutor/:vidyaId/fees",
  requireAuth,
  requireSelf,
  requireTutor,
  async (req, res): Promise<void> => {
    const params = RecordFeePaymentParams.safeParse(req.params);
    const body = RecordFeePaymentBody.safeParse(req.body);
    if (!params.success || !body.success) {
      res.status(400).json({ error: "Invalid input" });
      return;
    }

    // The tutor may only record payments for students linked to them.
    const linked = await getLinkedStudentFor(params.data.vidyaId, body.data.studentVidyaId);
    if (!linked) {
      res.status(404).json({ error: "Student not linked to this tutor" });
      return;
    }

    await db.insert(feePaymentsTable).values({
      tutorVidyaId: params.data.vidyaId,
      studentVidyaId: body.data.studentVidyaId,
      amount: body.data.amount,
      method: body.data.method,
      status: body.data.status ?? "paid",
      period: body.data.period ?? null,
      note: body.data.note ?? null,
      paidOn: body.data.paidOn ?? null,
    });

    res.json(RecordFeePaymentResponse.parse(await feesPayload(params.data.vidyaId)));
  },
);

router.delete(
  "/tutor/:vidyaId/fees/:feeId",
  requireAuth,
  requireSelf,
  requireTutor,
  async (req, res): Promise<void> => {
    const params = DeleteFeePaymentParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const feeId = Number(params.data.feeId);
    if (!Number.isInteger(feeId)) {
      res.status(400).json({ error: "Invalid fee id" });
      return;
    }

    // Only delete a record that belongs to this tutor.
    const deleted = await db
      .delete(feePaymentsTable)
      .where(
        and(
          eq(feePaymentsTable.id, feeId),
          eq(feePaymentsTable.tutorVidyaId, params.data.vidyaId),
        ),
      )
      .returning({ id: feePaymentsTable.id });
    if (deleted.length === 0) {
      res.status(404).json({ error: "Fee record not found" });
      return;
    }

    res.json(DeleteFeePaymentResponse.parse(await feesPayload(params.data.vidyaId)));
  },
);

router.post(
  "/tutor/:vidyaId/fees/remind",
  requireAuth,
  requireSelf,
  requireTutor,
  rateLimit({ windowMs: 60_000, max: 10, keyPrefix: "fee-remind" }),
  async (req, res): Promise<void> => {
    const params = SendFeeRemindersParams.safeParse(req.params);
    const body = SendFeeRemindersBody.safeParse(req.body);
    if (!params.success || !body.success) {
      res.status(400).json({ error: "Invalid input" });
      return;
    }
    const message = body.data.message.trim();
    if (!message) {
      res.status(400).json({ error: "Message required" });
      return;
    }

    const [tutor] = await db
      .select({ name: usersTable.name })
      .from(usersTable)
      .where(eq(usersTable.vidyaId, params.data.vidyaId))
      .limit(1);
    const tutorName = tutor?.name ?? "your tutor";

    // Fan a personalised reminder out to every parent of each selected student.
    // Each student is verified linked to this tutor first; the localised body is
    // built on the client (no name) and the student name is prepended here.
    const ids = [...new Set(body.data.studentVidyaIds)];
    let sent = 0;
    for (const studentVidyaId of ids) {
      const linked = await getLinkedStudentFor(params.data.vidyaId, studentVidyaId);
      if (!linked) continue;
      const parents = await linkedParentsOfStudent(studentVidyaId);
      if (parents.length === 0) continue;
      const personalised = `${linked.name} — ${message}`;
      for (const parent of parents) {
        await db.insert(directMessagesTable).values({
          tutorVidyaId: params.data.vidyaId,
          parentVidyaId: parent.vidyaId,
          senderRole: "tutor",
          body: personalised,
        });
        await createNotification({
          recipientVidyaId: parent.vidyaId,
          type: "fee",
          title: `Fee reminder from ${tutorName}`,
          body:
            personalised.length > 120
              ? `${personalised.slice(0, 120)}…`
              : personalised,
          linkTab: "messages",
        });
        sent += 1;
      }
    }

    res.json(SendFeeRemindersResponse.parse({ sent }));
  },
);

export default router;
