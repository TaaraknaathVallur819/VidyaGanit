import { Router, type IRouter } from "express";
import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { db, usersTable, directMessagesTable } from "@workspace/db";
import {
  GetMessageThreadsParams,
  GetMessageThreadsResponse,
  GetMessageThreadParams,
  GetMessageThreadResponse,
  SendMessageParams,
  SendMessageBody,
  SendMessageResponse,
} from "@workspace/api-zod";
import { requireAuth, requireSelf } from "../middlewares/auth";
import { rateLimit } from "../middlewares/rateLimit";
import { sharesStudent, messagingContacts } from "../lib/links";
import { createNotification } from "../lib/notify";

const router: IRouter = Router();

const MAX_MESSAGE_LEN = 2000;

type Role = "tutor" | "parent";

async function userRole(vidyaId: string): Promise<Role | null> {
  const [u] = await db
    .select({ role: usersTable.role })
    .from(usersTable)
    .where(eq(usersTable.vidyaId, vidyaId));
  if (u?.role === "tutor" || u?.role === "parent") return u.role;
  return null;
}

/**
 * Resolve the (tutorVidyaId, parentVidyaId) thread key for two accounts. Direct
 * messaging is a tutor⇄parent feature, so exactly one side must be a tutor and
 * the other a parent; anything else returns null.
 */
async function resolveThread(
  a: string,
  b: string,
): Promise<{ tutorVidyaId: string; parentVidyaId: string } | null> {
  const [ra, rb] = await Promise.all([userRole(a), userRole(b)]);
  if (ra === "tutor" && rb === "parent")
    return { tutorVidyaId: a, parentVidyaId: b };
  if (ra === "parent" && rb === "tutor")
    return { tutorVidyaId: b, parentVidyaId: a };
  return null;
}

async function threadMessages(
  tutorVidyaId: string,
  parentVidyaId: string,
  selfRole: Role,
) {
  const rows = await db
    .select()
    .from(directMessagesTable)
    .where(
      and(
        eq(directMessagesTable.tutorVidyaId, tutorVidyaId),
        eq(directMessagesTable.parentVidyaId, parentVidyaId),
      ),
    )
    .orderBy(asc(directMessagesTable.createdAt));
  return rows.map((r) => ({
    id: r.id,
    mine: r.senderRole === selfRole,
    body: r.body,
    createdAt: r.createdAt.toISOString(),
  }));
}

// ── Thread list (doubles as the contact list) ───────────────────────
router.get(
  "/messages/:vidyaId/threads",
  requireAuth,
  requireSelf,
  async (req, res): Promise<void> => {
    const params = GetMessageThreadsParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const selfRole = await userRole(params.data.vidyaId);
    if (!selfRole) {
      res.json(GetMessageThreadsResponse.parse({ threads: [] }));
      return;
    }
    const contacts = await messagingContacts(params.data.vidyaId, selfRole);
    const otherRole: Role = selfRole === "tutor" ? "parent" : "tutor";
    const threads = await Promise.all(
      contacts.map(async (c) => {
        const tutorVidyaId =
          selfRole === "tutor" ? params.data.vidyaId : c.vidyaId;
        const parentVidyaId =
          selfRole === "tutor" ? c.vidyaId : params.data.vidyaId;
        const rows = await db
          .select()
          .from(directMessagesTable)
          .where(
            and(
              eq(directMessagesTable.tutorVidyaId, tutorVidyaId),
              eq(directMessagesTable.parentVidyaId, parentVidyaId),
            ),
          )
          .orderBy(desc(directMessagesTable.createdAt));
        const last = rows[0];
        // Unread for me = messages the other side sent that I haven't opened.
        const unread = rows.filter(
          (r) => r.senderRole === otherRole && r.readAt === null,
        ).length;
        return {
          otherVidyaId: c.vidyaId,
          otherName: c.name,
          otherRole: c.role,
          lastBody: last?.body ?? "",
          lastAt: (last?.createdAt ?? new Date(0)).toISOString(),
          unread,
        };
      }),
    );
    threads.sort((a, b) => b.lastAt.localeCompare(a.lastAt));
    res.json(GetMessageThreadsResponse.parse({ threads }));
  },
);

// ── One conversation (marks the other side's messages read) ─────────
router.get(
  "/messages/:vidyaId/thread/:otherVidyaId",
  requireAuth,
  requireSelf,
  async (req, res): Promise<void> => {
    const params = GetMessageThreadParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const selfRole = await userRole(params.data.vidyaId);
    const thread = await resolveThread(
      params.data.vidyaId,
      params.data.otherVidyaId,
    );
    if (!selfRole || !thread) {
      res.status(403).json({ error: "You can't message this user." });
      return;
    }
    if (!(await sharesStudent(params.data.vidyaId, params.data.otherVidyaId))) {
      res.status(403).json({ error: "You don't share a student with this user." });
      return;
    }
    const [other] = await db
      .select({ name: usersTable.name, role: usersTable.role })
      .from(usersTable)
      .where(eq(usersTable.vidyaId, params.data.otherVidyaId));
    // Mark messages the other side sent to me as read.
    await db
      .update(directMessagesTable)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(directMessagesTable.tutorVidyaId, thread.tutorVidyaId),
          eq(directMessagesTable.parentVidyaId, thread.parentVidyaId),
          eq(directMessagesTable.senderRole, selfRole === "tutor" ? "parent" : "tutor"),
          isNull(directMessagesTable.readAt),
        ),
      );
    res.json(
      GetMessageThreadResponse.parse({
        otherVidyaId: params.data.otherVidyaId,
        otherName: other?.name ?? "",
        otherRole: other?.role ?? "",
        messages: await threadMessages(
          thread.tutorVidyaId,
          thread.parentVidyaId,
          selfRole,
        ),
      }),
    );
  },
);

// ── Send ────────────────────────────────────────────────────────────
router.post(
  "/messages/:vidyaId/send",
  requireAuth,
  requireSelf,
  rateLimit({ windowMs: 60_000, max: 30, keyPrefix: "messages" }),
  async (req, res): Promise<void> => {
    const params = SendMessageParams.safeParse(req.params);
    const body = SendMessageBody.safeParse(req.body);
    if (!params.success || !body.success) {
      res.status(400).json({ error: "Invalid input" });
      return;
    }
    const text = body.data.body.trim();
    if (!text || text.length > MAX_MESSAGE_LEN) {
      res.status(400).json({ error: "Message must be 1–2000 characters." });
      return;
    }
    const selfRole = await userRole(params.data.vidyaId);
    const thread = await resolveThread(params.data.vidyaId, body.data.to);
    if (!selfRole || !thread) {
      res.status(403).json({ error: "You can't message this user." });
      return;
    }
    if (!(await sharesStudent(params.data.vidyaId, body.data.to))) {
      res.status(403).json({ error: "You don't share a student with this user." });
      return;
    }
    await db.insert(directMessagesTable).values({
      tutorVidyaId: thread.tutorVidyaId,
      parentVidyaId: thread.parentVidyaId,
      senderRole: selfRole,
      body: text,
    });
    const [sender] = await db
      .select({ name: usersTable.name })
      .from(usersTable)
      .where(eq(usersTable.vidyaId, params.data.vidyaId));
    await createNotification({
      recipientVidyaId: body.data.to,
      type: "message",
      title: `New message from ${sender?.name ?? "your contact"}`,
      body: text.length > 80 ? `${text.slice(0, 80)}…` : text,
      linkTab: "messages",
    });
    const [other] = await db
      .select({ name: usersTable.name, role: usersTable.role })
      .from(usersTable)
      .where(eq(usersTable.vidyaId, body.data.to));
    res.json(
      SendMessageResponse.parse({
        otherVidyaId: body.data.to,
        otherName: other?.name ?? "",
        otherRole: other?.role ?? "",
        messages: await threadMessages(
          thread.tutorVidyaId,
          thread.parentVidyaId,
          selfRole,
        ),
      }),
    );
  },
);

export default router;
