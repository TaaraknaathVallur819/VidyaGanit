import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { and, eq } from "drizzle-orm";
import { db, usersTable, parentStudentLinksTable } from "@workspace/db";
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
  UnlinkStudentParams,
  UnlinkStudentResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

function toProfile(user: typeof usersTable.$inferSelect) {
  return {
    vidyaId: user.vidyaId,
    name: user.name,
    role: user.role as "student" | "parent",
    gender: user.gender as "male" | "female",
    studentClass: user.studentClass ?? null,
    board: user.board ?? null,
    parentType: user.parentType ?? null,
    contact: user.contact ?? null,
    xp: user.xp ?? 0,
    badges: user.badges ?? [],
  };
}

router.get("/profile/:vidyaId", async (req, res): Promise<void> => {
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

router.patch("/profile/:vidyaId", async (req, res): Promise<void> => {
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

router.post("/profile/:vidyaId/change-password", async (req, res): Promise<void> => {
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

router.get("/profile/:vidyaId/linked-students", async (req, res): Promise<void> => {
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
      })),
    }),
  );
});

router.post("/profile/:vidyaId/link-student", async (req, res): Promise<void> => {
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

  const { studentVidyaId } = body.data;

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

router.delete(
  "/profile/:vidyaId/link-student/:studentVidyaId",
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
