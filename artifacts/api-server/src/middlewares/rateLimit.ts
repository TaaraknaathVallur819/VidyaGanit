import type { Request, Response, NextFunction } from "express";
import { sql } from "drizzle-orm";
import { db, rateLimitBucketsTable } from "@workspace/db";
import { logger } from "../lib/logger";

type FallbackBucket = { count: number; resetAt: number };

// Per-instance fallback used ONLY when the shared Postgres store is
// unavailable, so abuse stays bounded during a DB outage instead of the
// limiter silently failing open.
const fallbackStore = new Map<string, FallbackBucket>();

// Periodically delete expired buckets (shared + fallback) so neither store can
// grow unbounded.
const cleanup = setInterval(() => {
  void db
    .delete(rateLimitBucketsTable)
    .where(sql`${rateLimitBucketsTable.resetAt} < now()`)
    .catch((err) => logger.warn({ err }, "rate-limit cleanup failed"));
  const now = Date.now();
  for (const [key, bucket] of fallbackStore) {
    if (now > bucket.resetAt) fallbackStore.delete(key);
  }
}, 60_000);
cleanup.unref();

export type RateLimitOptions = {
  windowMs: number;
  max: number;
  keyPrefix: string;
  message?: string;
};

/** Fixed-window count against the in-memory fallback store. Returns true when over the limit. */
function fallbackExceeds(key: string, max: number, resetAtMs: number): boolean {
  const now = Date.now();
  const bucket = fallbackStore.get(key);
  if (!bucket || now > bucket.resetAt) {
    fallbackStore.set(key, { count: 1, resetAt: resetAtMs });
    return false;
  }
  bucket.count += 1;
  return bucket.count > max;
}

/**
 * Fixed-window rate limiter backed by Postgres so limits hold across multiple
 * server instances. Keys by the authenticated `vidyaId` when present, falling
 * back to the client IP. The window start is part of the row key, so each new
 * window is a fresh row and the per-window count is an atomic upsert/increment.
 *
 * If the database is unavailable it does NOT fail open: it enforces the same
 * limit via a bounded per-instance in-memory fallback, keeping abuse capped
 * during a DB outage while still letting legitimate traffic through.
 */
export function rateLimit(opts: RateLimitOptions) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const identity = req.vidyaId ?? req.ip ?? "anonymous";
    const now = Date.now();
    const windowStart = Math.floor(now / opts.windowMs) * opts.windowMs;
    const resetAt = new Date(windowStart + opts.windowMs);
    const key = `${opts.keyPrefix}:${identity}:${windowStart}`;

    let exceeded: boolean;
    try {
      const [row] = await db
        .insert(rateLimitBucketsTable)
        .values({ key, count: 1, resetAt })
        .onConflictDoUpdate({
          target: rateLimitBucketsTable.key,
          set: { count: sql`${rateLimitBucketsTable.count} + 1` },
        })
        .returning({ count: rateLimitBucketsTable.count });
      exceeded = (row?.count ?? 1) > opts.max;
    } catch (err) {
      req.log.warn({ err }, "rate-limit store unavailable; using in-memory fallback");
      exceeded = fallbackExceeds(key, opts.max, windowStart + opts.windowMs);
    }

    if (exceeded) {
      res.setHeader("Retry-After", String(Math.ceil((resetAt.getTime() - now) / 1000)));
      res.status(429).json({
        error:
          opts.message ??
          "You're sending messages too fast! Take a short break and try again. 😊",
      });
      return;
    }

    next();
  };
}
