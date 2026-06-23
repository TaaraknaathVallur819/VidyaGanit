import { Router, type IRouter } from "express";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { db, notificationsTable } from "@workspace/db";
import {
  GetNotificationsParams,
  GetNotificationsResponse,
  MarkNotificationsReadParams,
  MarkNotificationsReadBody,
} from "@workspace/api-zod";
import { requireAuth, requireSelf } from "../middlewares/auth";
import { getNotificationFeed } from "../lib/notify";

const router: IRouter = Router();

// ── Notification feed ───────────────────────────────────────────────
router.get(
  "/notifications/:vidyaId",
  requireAuth,
  requireSelf,
  async (req, res): Promise<void> => {
    const params = GetNotificationsParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    res.json(GetNotificationsResponse.parse(await getNotificationFeed(params.data.vidyaId)));
  },
);

router.post(
  "/notifications/:vidyaId/read",
  requireAuth,
  requireSelf,
  async (req, res): Promise<void> => {
    const params = MarkNotificationsReadParams.safeParse(req.params);
    const body = MarkNotificationsReadBody.safeParse(req.body);
    if (!params.success || !body.success) {
      res.status(400).json({ error: "Invalid input" });
      return;
    }
    const ids = body.data.ids ?? null;
    if (ids && ids.length > 0) {
      await db
        .update(notificationsTable)
        .set({ readAt: new Date() })
        .where(
          and(
            eq(notificationsTable.recipientVidyaId, params.data.vidyaId),
            inArray(notificationsTable.id, ids),
            isNull(notificationsTable.readAt),
          ),
        );
    } else {
      // No ids → mark the whole feed read.
      await db
        .update(notificationsTable)
        .set({ readAt: new Date() })
        .where(
          and(
            eq(notificationsTable.recipientVidyaId, params.data.vidyaId),
            isNull(notificationsTable.readAt),
          ),
        );
    }
    res.json(GetNotificationsResponse.parse(await getNotificationFeed(params.data.vidyaId)));
  },
);

export default router;
