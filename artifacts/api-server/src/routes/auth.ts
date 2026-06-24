import { Router, type IRouter, type Response, type Request } from "express";
import bcrypt from "bcryptjs";
import { randomBytes, createHash } from "node:crypto";
import { and, eq, gt } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import {
  RegisterUserBody,
  LoginUserBody,
  ForgotPasswordBody,
  ResetPasswordBody,
  LoginUserResponse,
} from "@workspace/api-zod";
import { signSession, SESSION_COOKIE, SESSION_MAX_AGE_MS } from "../lib/session";
import { sendPasswordResetEmail } from "../lib/email";

const router: IRouter = Router();

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

function generateVidyaId(role: "student" | "parent" | "tutor"): string {
  const digits = Math.floor(10000 + Math.random() * 90000).toString();
  const prefix = role === "student" ? "VG-STU-" : role === "parent" ? "VG-PAR-" : "VG-TUT-";
  return `${prefix}${digits}`;
}

function hashResetToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Derive the public origin the browser used, so reset links point back to the app. */
function publicOrigin(req: Request): string {
  return (
    process.env.PUBLIC_APP_URL ||
    req.get("origin") ||
    `${req.protocol}://${req.get("host")}`
  ).replace(/\/$/, "");
}

function setSessionCookie(res: Response, vidyaId: string): void {
  res.cookie(SESSION_COOKIE, signSession(vidyaId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_MAX_AGE_MS,
    path: "/",
  });
}

function profileResponse(user: typeof usersTable.$inferSelect) {
  return LoginUserResponse.parse({
    vidyaId: user.vidyaId,
    name: user.name,
    role: user.role,
    gender: user.gender,
    studentClass: user.studentClass ?? null,
    board: user.board ?? null,
    parentType: user.parentType ?? null,
    contact: user.contact ?? null,
    batch: user.batch ?? null,
    batches: user.batches ?? null,
    academyName: user.academyName ?? null,
    branch: user.branch ?? null,
    language: user.language ?? null,
    xp: user.xp ?? 0,
    badges: user.badges ?? [],
  });
}

router.post("/auth/register", async (req, res): Promise<void> => {
  const parsed = RegisterUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { name, password, role, gender, studentClass, board, parentType, contact, batch, batches, academyName, branch } =
    parsed.data;

  // Tutors can teach several batches. Normalise the list (trim, drop blanks,
  // de-dupe) and keep the legacy single `batch` column in sync with the first.
  const cleanBatches = (batches ?? [])
    .map((b) => b.trim())
    .filter((b) => b.length > 0)
    .filter((b, i, arr) => arr.indexOf(b) === i);
  const batchesValue = cleanBatches.length > 0 ? cleanBatches : null;
  const legacyBatch = cleanBatches[0] ?? batch ?? null;

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
      batch: legacyBatch,
      batches: batchesValue,
      academyName: academyName ?? null,
      branch: role === "tutor" ? branch ?? null : null,
    })
    .returning();

  req.log.info({ vidyaId, role }, "New account registered");

  setSessionCookie(res, user.vidyaId);
  res.status(201).json(profileResponse(user));
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

  setSessionCookie(res, user.vidyaId);
  res.json(profileResponse(user));
});

router.post("/auth/forgot-password", async (req, res): Promise<void> => {
  const parsed = ForgotPasswordBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { vidyaId, contact } = parsed.data;

  // Uniform response for every branch so this endpoint never reveals whether an
  // account exists, whether it has a recovery contact, or whether the supplied
  // contact matched — preventing account enumeration.
  const genericResponse = () => {
    res.json({
      message:
        "If those details match an account, a password reset link has been sent to your registered contact.",
    });
  };

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.vidyaId, vidyaId));

  // A reset link is only ever sent when (a) the account exists, (b) it has a
  // stored recovery contact, and (c) the supplied contact matches that stored
  // contact. The link is always sent to the *stored* contact, never to the
  // request-supplied value — otherwise anyone could redirect a reset to an
  // address they control and take over the account.
  const normalised = (s: string) => s.trim().toLowerCase();
  if (
    !user ||
    !user.contact ||
    normalised(user.contact) !== normalised(contact)
  ) {
    genericResponse();
    return;
  }

  // Generate a single-use reset token; only its SHA-256 hash is persisted.
  const token = randomBytes(32).toString("hex");
  const resetTokenHash = hashResetToken(token);
  const resetTokenExpiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);

  await db
    .update(usersTable)
    .set({ resetTokenHash, resetTokenExpiresAt })
    .where(eq(usersTable.vidyaId, user.vidyaId));

  const link = `${publicOrigin(req)}/forgot-password?token=${token}`;

  try {
    await sendPasswordResetEmail({ to: user.contact.trim(), link, log: req.log });
  } catch (err) {
    req.log.error({ err, vidyaId }, "failed to send password reset email");
  }

  genericResponse();
});

router.post("/auth/reset-password", async (req, res): Promise<void> => {
  const parsed = ResetPasswordBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { token, newPassword } = parsed.data;
  const resetTokenHash = hashResetToken(token);

  const [user] = await db
    .select()
    .from(usersTable)
    .where(
      and(
        eq(usersTable.resetTokenHash, resetTokenHash),
        gt(usersTable.resetTokenExpiresAt, new Date()),
      ),
    );

  if (!user) {
    res.status(400).json({
      error: "This reset link is invalid or has expired. Please request a new one.",
    });
    return;
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);

  await db
    .update(usersTable)
    .set({ passwordHash, resetTokenHash: null, resetTokenExpiresAt: null })
    .where(eq(usersTable.vidyaId, user.vidyaId));

  req.log.info({ vidyaId: user.vidyaId }, "Password reset via token");

  res.json({ message: "Your password has been reset! You can now log in with your new password." });
});

export default router;
