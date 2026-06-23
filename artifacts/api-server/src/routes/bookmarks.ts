import { Router, type IRouter } from "express";
import { and, desc, eq } from "drizzle-orm";
import { db, bookmarksTable } from "@workspace/db";
import {
  GetBookmarksParams,
  GetBookmarksResponse,
  AddBookmarkParams,
  AddBookmarkBody,
  AddBookmarkResponse,
  RemoveBookmarkParams,
  RemoveBookmarkResponse,
} from "@workspace/api-zod";
import { requireAuth, requireSelf } from "../middlewares/auth";

const router: IRouter = Router();

async function bookmarksPayload(vidyaId: string) {
  const rows = await db
    .select()
    .from(bookmarksTable)
    .where(eq(bookmarksTable.vidyaId, vidyaId))
    .orderBy(desc(bookmarksTable.createdAt));
  return {
    bookmarks: rows.map((r) => ({
      id: r.id,
      kind: r.kind,
      refId: r.refId,
      label: r.label,
      payload: (r.payload as Record<string, unknown> | null) ?? null,
      createdAt: r.createdAt.toISOString(),
    })),
  };
}

router.get(
  "/bookmarks/:vidyaId",
  requireAuth,
  requireSelf,
  async (req, res): Promise<void> => {
    const params = GetBookmarksParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    res.json(GetBookmarksResponse.parse(await bookmarksPayload(params.data.vidyaId)));
  },
);

router.post(
  "/bookmarks/:vidyaId",
  requireAuth,
  requireSelf,
  async (req, res): Promise<void> => {
    const params = AddBookmarkParams.safeParse(req.params);
    const body = AddBookmarkBody.safeParse(req.body);
    if (!params.success || !body.success) {
      res.status(400).json({ error: "Invalid input" });
      return;
    }
    // The unique (vidyaId, kind, refId) constraint makes re-saving a no-op.
    await db
      .insert(bookmarksTable)
      .values({
        vidyaId: params.data.vidyaId,
        kind: body.data.kind,
        refId: body.data.refId,
        label: body.data.label,
        payload: body.data.payload ?? null,
      })
      .onConflictDoNothing();
    res.json(AddBookmarkResponse.parse(await bookmarksPayload(params.data.vidyaId)));
  },
);

router.delete(
  "/bookmarks/:vidyaId/:kind/:refId",
  requireAuth,
  requireSelf,
  async (req, res): Promise<void> => {
    const params = RemoveBookmarkParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    await db
      .delete(bookmarksTable)
      .where(
        and(
          eq(bookmarksTable.vidyaId, params.data.vidyaId),
          eq(bookmarksTable.kind, params.data.kind),
          eq(bookmarksTable.refId, params.data.refId),
        ),
      );
    res.json(
      RemoveBookmarkResponse.parse(await bookmarksPayload(params.data.vidyaId)),
    );
  },
);

export default router;
