import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import {
  RegisterUserBody,
  LoginUserBody,
  ForgotPasswordBody,
  LoginUserResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

function generateVidyaId(role: "student" | "parent"): string {
  const digits = Math.floor(10000 + Math.random() * 90000).toString();
  return role === "student" ? `VG-STU-${digits}` : `VG-PAR-${digits}`;
}

router.post("/auth/register", async (req, res): Promise<void> => {
  const parsed = RegisterUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { name, password, role, gender, studentClass, board, parentType, contact } = parsed.data;

  const [existing] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.name, name));

  if (existing) {
    res.status(409).json({ error: "Username is taken already, please try a different one" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const vidyaId = generateVidyaId(role);

  const [user] = await db
    .insert(usersTable)
    .values({
      vidyaId,
      name,
      passwordHash,
      role,
      gender,
      studentClass: studentClass ?? null,
      board: board ?? null,
      parentType: parentType ?? null,
      contact: contact ?? null,
    })
    .returning();

  req.log.info({ vidyaId }, "New account registered");

  res.status(201).json(
    LoginUserResponse.parse({
      vidyaId: user.vidyaId,
      name: user.name,
      role: user.role,
      gender: user.gender,
      studentClass: user.studentClass ?? null,
      board: user.board ?? null,
      parentType: user.parentType ?? null,
      contact: user.contact ?? null,
    }),
  );
});

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { vidyaId, password } = parsed.data;

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.vidyaId, vidyaId));

  if (!user) {
    res.status(401).json({ error: "Oops! That ID or password doesn't match our records. Please check and try again." });
    return;
  }

  const passwordMatch = await bcrypt.compare(password, user.passwordHash);
  if (!passwordMatch) {
    res.status(401).json({ error: "Oops! That ID or password doesn't match our records. Please check and try again." });
    return;
  }

  req.log.info({ vidyaId }, "User logged in");

  res.json(
    LoginUserResponse.parse({
      vidyaId: user.vidyaId,
      name: user.name,
      role: user.role,
      gender: user.gender,
      studentClass: user.studentClass ?? null,
      board: user.board ?? null,
      parentType: user.parentType ?? null,
      contact: user.contact ?? null,
    }),
  );
});

router.post("/auth/forgot-password", async (req, res): Promise<void> => {
  const parsed = ForgotPasswordBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { vidyaId, contact } = parsed.data;

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.vidyaId, vidyaId));

  if (!user) {
    res.status(404).json({ error: "We couldn't find an account with those details." });
    return;
  }

  if (user.contact) {
    const normalised = (s: string) => s.trim().toLowerCase();
    if (normalised(user.contact) !== normalised(contact)) {
      res.status(404).json({ error: "We couldn't find an account with those details." });
      return;
    }
  }

  res.json({ message: "A password reset link has been sent to your registered contact! (Mock feature for now)." });
});

export default router;
