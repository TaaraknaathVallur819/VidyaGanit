import { Router, type IRouter } from "express";
import { and, desc, eq, inArray } from "drizzle-orm";
import {
  db,
  usersTable,
  assignmentsTable,
  assignmentCompletionsTable,
  announcementsTable,
  parentStudentLinksTable,
  assessmentsTable,
} from "@workspace/db";
import {
  ListTutorAssignmentsParams,
  ListTutorAssignmentsResponse,
  CreateAssignmentParams,
  CreateAssignmentBody,
  ListAnnouncementsParams,
  ListAnnouncementsResponse,
  CreateAnnouncementParams,
  CreateAnnouncementBody,
  GetClassHeatmapParams,
  GetClassHeatmapResponse,
} from "@workspace/api-zod";
import { requireAuth, requireSelf, requireTutor } from "../middlewares/auth";
import { createNotification } from "../lib/notify";

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

// ── Assignments ─────────────────────────────────────────────────────
async function tutorAssignmentsPayload(tutorVidyaId: string) {
  const rows = await db
    .select()
    .from(assignmentsTable)
    .where(eq(assignmentsTable.tutorVidyaId, tutorVidyaId))
    .orderBy(desc(assignmentsTable.createdAt));
  const students = await tutorStudents(tutorVidyaId);
  const batchSize = new Map<string, number>();
  for (const s of students) {
    if (s.batch) batchSize.set(s.batch, (batchSize.get(s.batch) ?? 0) + 1);
  }
  const ids = rows.map((r) => r.id);
  const completions = ids.length
    ? await db
        .select()
        .from(assignmentCompletionsTable)
        .where(inArray(assignmentCompletionsTable.assignmentId, ids))
    : [];
  const completedByAssignment = new Map<number, number>();
  for (const c of completions) {
    if (c.status === "completed") {
      completedByAssignment.set(
        c.assignmentId,
        (completedByAssignment.get(c.assignmentId) ?? 0) + 1,
      );
    }
  }
  return {
    assignments: rows.map((r) => ({
      id: r.id,
      batch: r.batch,
      title: r.title,
      description: r.description ?? null,
      kind: r.kind,
      topic: r.topic ?? null,
      dueDate: r.dueDate ?? null,
      createdAt: r.createdAt.toISOString(),
      completedCount: completedByAssignment.get(r.id) ?? 0,
      totalCount: batchSize.get(r.batch) ?? 0,
    })),
  };
}

router.get(
  "/tutor/:vidyaId/assignments",
  requireAuth,
  requireSelf,
  requireTutor,
  async (req, res): Promise<void> => {
    const params = ListTutorAssignmentsParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    res.json(ListTutorAssignmentsResponse.parse(await tutorAssignmentsPayload(params.data.vidyaId)));
  },
);

router.post(
  "/tutor/:vidyaId/assignments",
  requireAuth,
  requireSelf,
  requireTutor,
  async (req, res): Promise<void> => {
    const params = CreateAssignmentParams.safeParse(req.params);
    const body = CreateAssignmentBody.safeParse(req.body);
    if (!params.success || !body.success) {
      res.status(400).json({ error: "Invalid input" });
      return;
    }
    const [created] = await db
      .insert(assignmentsTable)
      .values({
        tutorVidyaId: params.data.vidyaId,
        batch: body.data.batch,
        title: body.data.title,
        description: body.data.description ?? null,
        kind: body.data.kind,
        topic: body.data.topic ?? null,
        dueDate: body.data.dueDate ?? null,
      })
      .returning({ id: assignmentsTable.id });
    // Notify every student in the batch.
    const students = await tutorStudents(params.data.vidyaId);
    for (const s of students) {
      if (s.batch === body.data.batch) {
        await createNotification({
          recipientVidyaId: s.studentVidyaId,
          type: "assignment",
          title: "New assignment",
          body: body.data.title,
          linkTab: "assignments",
        });
      }
    }
    void created;
    res.json(ListTutorAssignmentsResponse.parse(await tutorAssignmentsPayload(params.data.vidyaId)));
  },
);

// ── Announcements ───────────────────────────────────────────────────
async function announcementsPayload(tutorVidyaId: string) {
  const rows = await db
    .select()
    .from(announcementsTable)
    .where(eq(announcementsTable.tutorVidyaId, tutorVidyaId))
    .orderBy(desc(announcementsTable.createdAt));
  return {
    announcements: rows.map((r) => ({
      id: r.id,
      batch: r.batch,
      message: r.message,
      createdAt: r.createdAt.toISOString(),
    })),
  };
}

router.get(
  "/tutor/:vidyaId/announcements",
  requireAuth,
  requireSelf,
  requireTutor,
  async (req, res): Promise<void> => {
    const params = ListAnnouncementsParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    res.json(ListAnnouncementsResponse.parse(await announcementsPayload(params.data.vidyaId)));
  },
);

router.post(
  "/tutor/:vidyaId/announcements",
  requireAuth,
  requireSelf,
  requireTutor,
  async (req, res): Promise<void> => {
    const params = CreateAnnouncementParams.safeParse(req.params);
    const body = CreateAnnouncementBody.safeParse(req.body);
    if (!params.success || !body.success) {
      res.status(400).json({ error: "Invalid input" });
      return;
    }
    await db.insert(announcementsTable).values({
      tutorVidyaId: params.data.vidyaId,
      batch: body.data.batch,
      message: body.data.message,
    });
    const students = await tutorStudents(params.data.vidyaId);
    for (const s of students) {
      if (s.batch === body.data.batch) {
        await createNotification({
          recipientVidyaId: s.studentVidyaId,
          type: "announcement",
          title: "Announcement from your tutor",
          body: body.data.message,
          linkTab: "notifications",
        });
      }
    }
    res.json(ListAnnouncementsResponse.parse(await announcementsPayload(params.data.vidyaId)));
  },
);

// ── Class heatmap ───────────────────────────────────────────────────
router.get(
  "/tutor/:vidyaId/heatmap",
  requireAuth,
  requireSelf,
  requireTutor,
  async (req, res): Promise<void> => {
    const params = GetClassHeatmapParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const students = await tutorStudents(params.data.vidyaId);
    const studentIds = students.map((s) => s.studentVidyaId);
    const tests = studentIds.length
      ? await db
          .select()
          .from(assessmentsTable)
          .where(
            and(
              inArray(assessmentsTable.studentVidyaId, studentIds),
              eq(assessmentsTable.status, "completed"),
            ),
          )
      : [];

    // Best graded-test percentage per (student, topicLabel).
    const best = new Map<string, Map<string, number>>();
    const topicSet = new Set<string>();
    for (const t of tests) {
      const max = t.totalQuestions * t.pointsPerCorrect;
      if (max <= 0) continue;
      const pct = Math.round(((t.score ?? 0) / max) * 100);
      topicSet.add(t.topicLabel);
      let perTopic = best.get(t.studentVidyaId);
      if (!perTopic) {
        perTopic = new Map();
        best.set(t.studentVidyaId, perTopic);
      }
      perTopic.set(t.topicLabel, Math.max(perTopic.get(t.topicLabel) ?? 0, pct));
    }

    const topics = [...topicSet].sort();
    const rows = students.map((s) => {
      const perTopic = best.get(s.studentVidyaId);
      const topicScores: Record<string, number> = {};
      for (const topic of topics) {
        topicScores[topic] = perTopic?.get(topic) ?? 0;
      }
      return {
        studentVidyaId: s.studentVidyaId,
        name: s.name,
        batch: s.batch ?? null,
        topics: topicScores,
      };
    });

    res.json(GetClassHeatmapResponse.parse({ topics, rows }));
  },
);

export default router;
