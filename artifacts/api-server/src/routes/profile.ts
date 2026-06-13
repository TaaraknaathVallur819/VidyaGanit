import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import {
  GetProfileParams,
  GetProfileResponse,
  UpdateProfileParams,
  UpdateProfileBody,
  UpdateProfileResponse,
  ChangePasswordParams,
  ChangePasswordBody,
  ChangePasswordResponse,
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

export default router;
