import type { Request, Response, NextFunction } from "express";

type Bucket = { count: number; resetAt: number };

const store = new Map<string, Bucket>();

// Periodically prune expired buckets so the map can't grow unbounded.
const cleanup = setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of store) {
    if (now > bucket.resetAt) store.delete(key);
  }
}, 60_000);
cleanup.unref();

export type RateLimitOptions = {
  windowMs: number;
  max: number;
  keyPrefix: string;
  message?: string;
};

/**
 * Simple in-memory fixed-window rate limiter. Keys by the authenticated
 * `vidyaId` when present, falling back to the client IP. Suitable for a
 * single-instance deployment; swap for a shared store if scaled horizontally.
 */
export function rateLimit(opts: RateLimitOptions) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const identity = req.vidyaId ?? req.ip ?? "anonymous";
    const key = `${opts.keyPrefix}:${identity}`;
    const now = Date.now();

    const bucket = store.get(key);
    if (!bucket || now > bucket.resetAt) {
      store.set(key, { count: 1, resetAt: now + opts.windowMs });
      next();
      return;
    }

    if (bucket.count >= opts.max) {
      res.setHeader("Retry-After", String(Math.ceil((bucket.resetAt - now) / 1000)));
      res.status(429).json({
        error:
          opts.message ??
          "You're sending messages too fast! Take a short break and try again. 😊",
      });
      return;
    }

    bucket.count += 1;
    next();
  };
}
