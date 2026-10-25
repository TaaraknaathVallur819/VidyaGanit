import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const router: IRouter = Router();
let preparing: Promise<void> | undefined;
let readyUntil = 0;

// Read-only preparation wakes the database before a visitor submits a form.
// Coalesce simultaneous visitors and briefly cache success to limit queries.
router.get("/readyz", async (_req, res): Promise<void> => {
  res.set("Cache-Control", "no-store");
  try {
    if (Date.now() >= readyUntil) {
      preparing ??= Promise.resolve(db.execute(sql`SELECT 1`))
        .then(() => {
          readyUntil = Date.now() + 30_000;
        })
        .finally(() => {
          preparing = undefined;
        });
      await preparing;
    }
    res.status(204).end();
  } catch {
    res.status(503).json({ error: "Temporarily unavailable" });
  }
});

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

export default router;
