import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { and, eq } from "drizzle-orm";
import { db, usersTable, parentStudentLinksTable } from "@workspace/db";
import { requireAuth, requireSelf, requireParentOrTutor } from "../middlewares/auth";
import {
  GetProfileParams,
  GetProfileResponse,
  UpdateProfileParams,
  UpdateProfileBody,
  UpdateProfileResponse,
  ChangePasswordParams,
  ChangePasswordBody,
  ChangePasswordResponse,
  GetLinkedStudentsParams,
  GetLinkedStudentsResponse,
  LinkStudentParams,
  LinkStudentBody,
  LinkStudentResponse,
  BulkLinkStudentsParams,
  BulkLinkStudentsBody,
  BulkLinkStudentsResponse,
  UnlinkStudentParams,
  UnlinkStudentResponse,
  GetOwnAnalyticsParams,
  GetOwnAnalyticsResponse,
} from "@workspace/api-zod";
import { computeStudentAnalytics } from "../lib/analytics";

const router: IRouter = Router();

function toProfile(user: typeof usersTable.$inferSelect) {
  return {
    vidyaId: user.vidyaId,
    name: user.name,
    role: user.role as "student" | "parent" | "tutor",
    gender: user.gender as "male" | "female",
    studentClass: user.studentClass ?? null,
    board: user.board ?? null,
    parentType: user.parentType ?? null,
    contact: user.contact ?? null,
    batch: user.batch ?? null,
    batches: user.batches ?? null,
    academyName: user.academyName ?? null,
    language: user.language ?? null,
    xp: user.xp ?? 0,
    badges: user.badges ?? [],
    voiceRate: user.voiceRate ?? 1,
    voicePitch: user.voicePitch ?? 1,
    voiceName: user.voiceName ?? null,
  };
}

router.get("/profile/:vidyaId", requireAuth, requireSelf, async (req, res): Promise<void> => {
  const params = GetProfileParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.vidyaId, params.data.vidyaId));

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.json(GetProfileResponse.parse(toProfile(user)));
});

// A student's own per-topic practice analytics. requireSelf ensures a user can
// only read their own progress, never another account's.
router.get(
  "/profile/:vidyaId/analytics",
  requireAuth,
  requireSelf,
  async (req, res): Promise<void> => {
    const params = GetOwnAnalyticsParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.vidyaId, params.data.vidyaId));

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const analytics = await computeStudentAnalytics(user.vidyaId);

    res.json(
      GetOwnAnalyticsResponse.parse({
        studentVidyaId: user.vidyaId,
        name: user.name,
        studentClass: user.studentClass ?? null,
        board: user.board ?? null,
        ...analytics,
      }),
    );
  },
);

router.patch("/profile/:vidyaId", requireAuth, requireSelf, async (req, res): Promise<void> => {
  const params = UpdateProfileParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const body = UpdateProfileBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const updates: Partial<typeof usersTable.$inferInsert> = {};
  if (body.data.name !== undefined) updates.name = body.data.name;
  if (body.data.gender !== undefined) updates.gender = body.data.gender;
  if (body.data.contact !== undefined) updates.contact = body.data.contact ?? null;
  if (body.data.language !== undefined) updates.language = body.data.language;
  // Read-aloud voice settings: clamp to the same ranges the browser SpeechSynthesis
  // API accepts so a bad client value can never be persisted.
  if (body.data.voiceRate !== undefined && body.data.voiceRate !== null) {
    updates.voiceRate = Math.min(2, Math.max(0.5, body.data.voiceRate));
  }
  if (body.data.voicePitch !== undefined && body.data.voicePitch !== null) {
    updates.voicePitch = Math.min(2, Math.max(0, body.data.voicePitch));
  }
  if (body.data.voiceName !== undefined) {
    updates.voiceName = body.data.voiceName ? body.data.voiceName.slice(0, 200) : null;
  }

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "No fields to update" });
    return;
  }

  const [user] = await db
    .update(usersTable)
    .set(updates)
    .where(eq(usersTable.vidyaId, params.data.vidyaId))
    .returning();

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  req.log.info({ vidyaId: params.data.vidyaId }, "Profile updated");
  res.json(UpdateProfileResponse.parse(toProfile(user)));
});

router.post(
  "/profile/:vidyaId/change-password",
  requireAuth,
  requireSelf,
  async (req, res): Promise<void> => {
    const params = ChangePasswordParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const body = ChangePasswordBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.vidyaId, params.data.vidyaId));

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const match = await bcrypt.compare(body.data.currentPassword, user.passwordHash);
  if (!match) {
    res.status(401).json({ error: "Current password is incorrect. Please try again." });
    return;
  }

  const newHash = await bcrypt.hash(body.data.newPassword, 10);
  await db
    .update(usersTable)
    .set({ passwordHash: newHash })
    .where(eq(usersTable.vidyaId, params.data.vidyaId));

  req.log.info({ vidyaId: params.data.vidyaId }, "Password changed");
  res.json(ChangePasswordResponse.parse({ message: "Password updated successfully!" }));
});

router.get(
  "/profile/:vidyaId/linked-students",
  requireAuth,
  requireSelf,
  async (req, res): Promise<void> => {
    const params = GetLinkedStudentsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const links = await db
    .select({
      vidyaId: usersTable.vidyaId,
      name: usersTable.name,
      gender: usersTable.gender,
      studentClass: usersTable.studentClass,
      board: usersTable.board,
      batch: parentStudentLinksTable.batch,
    })
    .from(parentStudentLinksTable)
    .innerJoin(usersTable, eq(usersTable.vidyaId, parentStudentLinksTable.studentVidyaId))
    .where(eq(parentStudentLinksTable.parentVidyaId, params.data.vidyaId));

  res.json(
    GetLinkedStudentsResponse.parse({
      students: links.map((s) => ({
        vidyaId: s.vidyaId,
        name: s.name,
        gender: s.gender,
        studentClass: s.studentClass ?? null,
        board: s.board ?? null,
        batch: s.batch ?? null,
      })),
    }),
  );
});

router.post(
  "/profile/:vidyaId/link-student",
  requireAuth,
  requireSelf,
  requireParentOrTutor,
  async (req, res): Promise<void> => {
    const params = LinkStudentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const body = LinkStudentBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const { studentVidyaId, batch } = body.data;

  if (studentVidyaId === params.data.vidyaId) {
    res.status(400).json({ error: "You cannot link your own account." });
    return;
  }

  const [student] = await db
    .select()
    .from(usersTable)
    .where(and(eq(usersTable.vidyaId, studentVidyaId), eq(usersTable.role, "student")));

  if (!student) {
    res.status(404).json({ error: "No student found with that VidyaGanit ID." });
    return;
  }

  try {
    await db.insert(parentStudentLinksTable).values({
      parentVidyaId: params.data.vidyaId,
      studentVidyaId,
      batch: batch?.trim() || null,
    });
  } catch {
    res.status(400).json({ error: "This student is already linked to your account." });
    return;
  }

  req.log.info({ parentVidyaId: params.data.vidyaId, studentVidyaId }, "Student linked");
  res.json(
    LinkStudentResponse.parse({
      vidyaId: student.vidyaId,
      name: student.name,
      gender: student.gender,
      studentClass: student.studentClass ?? null,
      board: student.board ?? null,
    }),
  );
});

// Bulk-link many students in one request. Each ID is resolved independently and
// gets its own status so the client can show a per-ID summary; a bad ID never
// aborts the whole batch. Capped to keep a single request bounded.
const MAX_BULK_LINK = 100;

router.post(
  "/profile/:vidyaId/link-students",
  requireAuth,
  requireSelf,
  requireParentOrTutor,
  async (req, res): Promise<void> => {
    const params = BulkLinkStudentsParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const body = BulkLinkStudentsBody.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: body.error.message });
      return;
    }

    const parentVidyaId = params.data.vidyaId;
    const batch = body.data.batch?.trim() || null;

    // Normalise: uppercase, trim, drop blanks, de-dupe — preserving first-seen order.
    const ids = body.data.studentVidyaIds
      .map((id) => id.trim().toUpperCase())
      .filter((id) => id.length > 0)
      .filter((id, i, arr) => arr.indexOf(id) === i)
      .slice(0, MAX_BULK_LINK);

    const results: { vidyaId: string; status: string; name: string | null }[] = [];

    for (const studentVidyaId of ids) {
      if (studentVidyaId === parentVidyaId) {
        results.push({ vidyaId: studentVidyaId, status: "self", name: null });
        continue;
      }

      const [user] = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.vidyaId, studentVidyaId));

      if (!user) {
        results.push({ vidyaId: studentVidyaId, status: "not_found", name: null });
        continue;
      }
      if (user.role !== "student") {
        results.push({ vidyaId: studentVidyaId, status: "not_a_student", name: user.name });
        continue;
      }

      const inserted = await db
        .insert(parentStudentLinksTable)
        .values({ parentVidyaId, studentVidyaId, batch })
        .onConflictDoNothing({
          target: [
            parentStudentLinksTable.parentVidyaId,
            parentStudentLinksTable.studentVidyaId,
          ],
        })
        .returning();

      results.push({
        vidyaId: studentVidyaId,
        status: inserted.length > 0 ? "linked" : "already_linked",
        name: user.name,
      });
    }

    const linkedCount = results.filter((r) => r.status === "linked").length;
    req.log.info({ parentVidyaId, requested: ids.length, linked: linkedCount }, "Bulk student link");

    res.json(BulkLinkStudentsResponse.parse({ results }));
  },
);

router.delete(
  "/profile/:vidyaId/link-student/:studentVidyaId",
  requireAuth,
  requireSelf,
  requireParentOrTutor,
  async (req, res): Promise<void> => {
    const params = UnlinkStudentParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const deleted = await db
      .delete(parentStudentLinksTable)
      .where(
        and(
          eq(parentStudentLinksTable.parentVidyaId, params.data.vidyaId),
          eq(parentStudentLinksTable.studentVidyaId, params.data.studentVidyaId),
        ),
      )
      .returning();

    if (deleted.length === 0) {
      res.status(404).json({ error: "Link not found." });
      return;
    }

    req.log.info(
      { parentVidyaId: params.data.vidyaId, studentVidyaId: params.data.studentVidyaId },
      "Student unlinked",
    );
    res.json(UnlinkStudentResponse.parse({ message: "Student unlinked successfully." }));
  },
);

export default router;
