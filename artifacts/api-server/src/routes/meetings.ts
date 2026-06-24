import { Router, type IRouter } from "express";
import { and, desc, eq, inArray, or } from "drizzle-orm";
import { db, usersTable, meetingsTable } from "@workspace/db";
import {
  GetMeetingsParams,
  GetMeetingsResponse,
  ProposeMeetingParams,
  ProposeMeetingBody,
  ProposeMeetingResponse,
  RespondMeetingParams,
  RespondMeetingBody,
  RespondMeetingResponse,
  CancelMeetingParams,
  CancelMeetingResponse,
} from "@workspace/api-zod";
import { requireAuth, requireSelf, requireParentOrTutor } from "../middlewares/auth";
import { sharesStudent, messagingContacts } from "../lib/links";
import { createNotification } from "../lib/notify";

const router: IRouter = Router();

type MeetingRow = typeof meetingsTable.$inferSelect;

/** Build the meetings payload for a user (tutor or parent). */
async function meetingsPayload(vidyaId: string, role: "tutor" | "parent") {
  const rows = await db
    .select()
    .from(meetingsTable)
    .where(
      or(eq(meetingsTable.tutorVidyaId, vidyaId), eq(meetingsTable.parentVidyaId, vidyaId)),
    )
    .orderBy(desc(meetingsTable.scheduledAt));

  const ids = new Set<string>();
  for (const r of rows) {
    ids.add(r.tutorVidyaId);
    ids.add(r.parentVidyaId);
  }
  const nameRows = ids.size
    ? await db
        .select({ vidyaId: usersTable.vidyaId, name: usersTable.name })
        .from(usersTable)
        .where(inArray(usersTable.vidyaId, [...ids]))
    : [];
  const names = new Map(nameRows.map((n) => [n.vidyaId, n.name]));

  const meetings = rows.map((r) => {
    const tutorName = names.get(r.tutorVidyaId) ?? r.tutorVidyaId;
    const parentName = names.get(r.parentVidyaId) ?? r.parentVidyaId;
    return {
      id: r.id,
      tutorVidyaId: r.tutorVidyaId,
      parentVidyaId: r.parentVidyaId,
      tutorName,
      parentName,
      counterpartName: role === "tutor" ? parentName : tutorName,
      role,
      proposedBy: r.proposedBy as "tutor" | "parent",
      scheduledAt: r.scheduledAt.toISOString(),
      durationMin: r.durationMin,
      note: r.note ?? null,
      status: r.status as "pending" | "confirmed" | "declined" | "cancelled",
      createdAt: r.createdAt.toISOString(),
    };
  });

  const contacts = await messagingContacts(vidyaId, role);
  return { meetings, contacts };
}

async function roleOf(vidyaId: string): Promise<string | undefined> {
  const [u] = await db
    .select({ role: usersTable.role })
    .from(usersTable)
    .where(eq(usersTable.vidyaId, vidyaId));
  return u?.role;
}

router.get(
  "/meetings/:vidyaId",
  requireAuth,
  requireSelf,
  requireParentOrTutor,
  async (req, res): Promise<void> => {
    const params = GetMeetingsParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const role = (await roleOf(params.data.vidyaId)) as "tutor" | "parent";
    res.json(GetMeetingsResponse.parse(await meetingsPayload(params.data.vidyaId, role)));
  },
);

router.post(
  "/meetings/:vidyaId/propose",
  requireAuth,
  requireSelf,
  requireParentOrTutor,
  async (req, res): Promise<void> => {
    const params = ProposeMeetingParams.safeParse(req.params);
    const body = ProposeMeetingBody.safeParse(req.body);
    if (!params.success || !body.success) {
      res.status(400).json({ error: "Invalid input" });
      return;
    }
    const me = params.data.vidyaId;
    const counterpart = body.data.counterpartVidyaId;

    const when = new Date(body.data.scheduledAt);
    if (Number.isNaN(when.getTime())) {
      res.status(400).json({ error: "Invalid date/time" });
      return;
    }

    if (!(await sharesStudent(me, counterpart))) {
      res.status(404).json({ error: "Not a shared contact" });
      return;
    }

    const myRole = await roleOf(me);
    const theirRole = await roleOf(counterpart);
    // The pair must be exactly one tutor + one parent.
    const tutorVidyaId = myRole === "tutor" ? me : theirRole === "tutor" ? counterpart : null;
    const parentVidyaId = myRole === "parent" ? me : theirRole === "parent" ? counterpart : null;
    if (!tutorVidyaId || !parentVidyaId || myRole === theirRole) {
      res.status(400).json({ error: "A meeting must be between a parent and a tutor." });
      return;
    }

    await db.insert(meetingsTable).values({
      tutorVidyaId,
      parentVidyaId,
      studentVidyaId: body.data.studentVidyaId ?? null,
      proposedBy: myRole as "tutor" | "parent",
      scheduledAt: when,
      durationMin: body.data.durationMin ?? 30,
      note: body.data.note ?? null,
    });

    const [meUser] = await db
      .select({ name: usersTable.name })
      .from(usersTable)
      .where(eq(usersTable.vidyaId, me));
    await createNotification({
      recipientVidyaId: counterpart,
      type: "meeting",
      title: `${meUser?.name ?? "Someone"} proposed a meeting 📅`,
      body: when.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }),
      linkTab: "meetings",
    });

    const role = myRole as "tutor" | "parent";
    res.json(ProposeMeetingResponse.parse(await meetingsPayload(me, role)));
  },
);

router.post(
  "/meetings/:vidyaId/:meetingId/respond",
  requireAuth,
  requireSelf,
  requireParentOrTutor,
  async (req, res): Promise<void> => {
    const params = RespondMeetingParams.safeParse(req.params);
    const body = RespondMeetingBody.safeParse(req.body);
    if (!params.success || !body.success) {
      res.status(400).json({ error: "Invalid input" });
      return;
    }
    const me = params.data.vidyaId;
    const meetingId = Number(params.data.meetingId);
    if (!Number.isInteger(meetingId)) {
      res.status(400).json({ error: "Invalid meeting id" });
      return;
    }

    const [row] = await db
      .select()
      .from(meetingsTable)
      .where(eq(meetingsTable.id, meetingId));
    if (!row || (row.tutorVidyaId !== me && row.parentVidyaId !== me)) {
      res.status(404).json({ error: "Meeting not found" });
      return;
    }
    const myRole = row.tutorVidyaId === me ? "tutor" : "parent";
    // Only the party who did NOT propose can confirm/decline.
    if (row.proposedBy === myRole) {
      res.status(400).json({ error: "You proposed this meeting; wait for a response." });
      return;
    }
    if (row.status !== "pending") {
      res.status(400).json({ error: "This meeting is no longer pending." });
      return;
    }

    await db
      .update(meetingsTable)
      .set({ status: body.data.status })
      .where(eq(meetingsTable.id, meetingId));

    const proposerId = row.proposedBy === "tutor" ? row.tutorVidyaId : row.parentVidyaId;
    const [meUser] = await db
      .select({ name: usersTable.name })
      .from(usersTable)
      .where(eq(usersTable.vidyaId, me));
    await createNotification({
      recipientVidyaId: proposerId,
      type: "meeting",
      title: `${meUser?.name ?? "Someone"} ${body.data.status} your meeting`,
      body: row.scheduledAt.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }),
      linkTab: "meetings",
    });

    res.json(RespondMeetingResponse.parse(await meetingsPayload(me, myRole)));
  },
);

router.post(
  "/meetings/:vidyaId/:meetingId/cancel",
  requireAuth,
  requireSelf,
  requireParentOrTutor,
  async (req, res): Promise<void> => {
    const params = CancelMeetingParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const me = params.data.vidyaId;
    const meetingId = Number(params.data.meetingId);
    if (!Number.isInteger(meetingId)) {
      res.status(400).json({ error: "Invalid meeting id" });
      return;
    }

    const [row] = await db
      .select()
      .from(meetingsTable)
      .where(eq(meetingsTable.id, meetingId));
    if (!row || (row.tutorVidyaId !== me && row.parentVidyaId !== me)) {
      res.status(404).json({ error: "Meeting not found" });
      return;
    }
    const myRole = row.tutorVidyaId === me ? "tutor" : "parent";

    await db
      .update(meetingsTable)
      .set({ status: "cancelled" })
      .where(eq(meetingsTable.id, meetingId));

    const otherId = row.tutorVidyaId === me ? row.parentVidyaId : row.tutorVidyaId;
    const [meUser] = await db
      .select({ name: usersTable.name })
      .from(usersTable)
      .where(eq(usersTable.vidyaId, me));
    await createNotification({
      recipientVidyaId: otherId,
      type: "meeting",
      title: `${meUser?.name ?? "Someone"} cancelled a meeting`,
      body: row.scheduledAt.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }),
      linkTab: "meetings",
    });

    res.json(CancelMeetingResponse.parse(await meetingsPayload(me, myRole)));
  },
);

export default router;
