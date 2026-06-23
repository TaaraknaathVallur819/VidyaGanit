import { desc, eq, and, isNull } from "drizzle-orm";
import { db, notificationsTable } from "@workspace/db";

// Shared helpers for the in-app notification feed. Alerts (parent), assignments
// and announcements (tutor) all fan out into rows here so a single feed + unread
// badge powers every portal.

export interface NewNotification {
  recipientVidyaId: string;
  type: string;
  title: string;
  body: string;
  linkTab?: string | null;
}

/**
 * Insert a notification only if an identical unread one (same recipient, type
 * and title) doesn't already exist. This keeps repeated alert scans / re-sent
 * announcements from flooding the feed with duplicates.
 */
export async function createNotificationOnce(n: NewNotification): Promise<void> {
  const existing = await db
    .select({ id: notificationsTable.id })
    .from(notificationsTable)
    .where(
      and(
        eq(notificationsTable.recipientVidyaId, n.recipientVidyaId),
        eq(notificationsTable.type, n.type),
        eq(notificationsTable.title, n.title),
        isNull(notificationsTable.readAt),
      ),
    )
    .limit(1);
  if (existing.length > 0) return;
  await db.insert(notificationsTable).values({
    recipientVidyaId: n.recipientVidyaId,
    type: n.type,
    title: n.title,
    body: n.body,
    linkTab: n.linkTab ?? null,
  });
}

export async function createNotification(n: NewNotification): Promise<void> {
  await db.insert(notificationsTable).values({
    recipientVidyaId: n.recipientVidyaId,
    type: n.type,
    title: n.title,
    body: n.body,
    linkTab: n.linkTab ?? null,
  });
}

export async function getNotificationFeed(vidyaId: string) {
  const rows = await db
    .select()
    .from(notificationsTable)
    .where(eq(notificationsTable.recipientVidyaId, vidyaId))
    .orderBy(desc(notificationsTable.createdAt))
    .limit(100);

  return {
    unreadCount: rows.filter((r) => r.readAt === null).length,
    notifications: rows.map((r) => ({
      id: r.id,
      type: r.type,
      title: r.title,
      body: r.body,
      linkTab: r.linkTab ?? null,
      read: r.readAt !== null,
      createdAt: r.createdAt.toISOString(),
    })),
  };
}
