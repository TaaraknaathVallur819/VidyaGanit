import type { Request, Response, NextFunction } from "express";
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
