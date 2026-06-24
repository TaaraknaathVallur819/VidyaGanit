import type { Request, Response, NextFunction } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { verifySession, SESSION_COOKIE } from "../lib/session";

/**
 * Rejects requests without a valid signed session cookie. On success it binds
 * the authenticated `vidyaId` to the request so handlers never have to trust a
 * client-supplied identity.
 */
export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const token = req.cookies?.[SESSION_COOKIE] as string | undefined;
  const vidyaId = verifySession(token);
  if (!vidyaId) {
    res.status(401).json({ error: "Please log in to continue." });
    return;
  }
  req.vidyaId = vidyaId;
  next();
}

/**
 * Must run after `requireAuth`. Rejects requests where the authenticated
 * `vidyaId` does not match the `:vidyaId` route param, so a logged-in user can
 * only read or modify their own account.
 */
export function requireSelf(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (req.vidyaId !== req.params.vidyaId) {
    res.status(403).json({ error: "You can only access your own account." });
    return;
  }
  next();
}

/**
 * Must run after `requireAuth`. Rejects authenticated users whose account role
 * is not `tutor`, so tutor-only surfaces (e.g. curriculum planning) cannot be
 * reached by parents or students even if they call the API directly.
 */
export async function requireTutor(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const vidyaId = req.vidyaId;
  if (!vidyaId) {
    res.status(401).json({ error: "Please log in to continue." });
    return;
  }
  const rows = await db
    .select({ role: usersTable.role })
    .from(usersTable)
    .where(eq(usersTable.vidyaId, vidyaId))
    .limit(1);
  if (rows[0]?.role !== "tutor") {
    res.status(403).json({ error: "This area is for tutors only." });
    return;
  }
  next();
}

/**
 * Must run after `requireAuth`. Rejects authenticated users whose account role
 * is not `student`, so student-only surfaces (e.g. peer math duels, mock exams)
 * cannot be reached by parents or tutors even if they call the API directly.
 */
export async function requireStudent(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const vidyaId = req.vidyaId;
  if (!vidyaId) {
    res.status(401).json({ error: "Please log in to continue." });
    return;
  }
  const rows = await db
    .select({ role: usersTable.role })
    .from(usersTable)
    .where(eq(usersTable.vidyaId, vidyaId))
    .limit(1);
  if (rows[0]?.role !== "student") {
    res.status(403).json({ error: "This area is for students only." });
    return;
  }
  next();
}

/**
 * Must run after `requireAuth`. Rejects authenticated users whose account role
 * is not `parent` or `tutor`. Linking students to an account is a parent/tutor
 * capability, so a student must never be able to attach other students to their
 * own account even if they call the API directly.
 */
export async function requireParentOrTutor(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const vidyaId = req.vidyaId;
  if (!vidyaId) {
    res.status(401).json({ error: "Please log in to continue." });
    return;
  }
  const rows = await db
    .select({ role: usersTable.role })
    .from(usersTable)
    .where(eq(usersTable.vidyaId, vidyaId))
    .limit(1);
  const role = rows[0]?.role;
  if (role !== "parent" && role !== "tutor") {
    res.status(403).json({ error: "Only parents and tutors can link students." });
    return;
  }
  next();
}
