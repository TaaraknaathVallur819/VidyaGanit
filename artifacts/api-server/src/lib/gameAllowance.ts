import { eq, sql } from "drizzle-orm";
import { db, rateLimitBucketsTable } from "@workspace/db";
import { FREE_LIMITS, studentPremiumSource } from "./planAccess";

// Free students get FREE_LIMITS.studentGamesPerDay games a day. A student whose
// linked parent has Family Plus, or whose linked tutor has Tutor Pro, is
// unlimited. Counts live in the existing rate_limit_buckets table, one row per
// student per day, so this needs no new table or migration.

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** The current day for Indian students: it rolls over at midnight IST. */
function istDay(now = Date.now()) {
  const dayIndex = Math.floor((now + IST_OFFSET_MS) / DAY_MS);
  return { dayIndex, resetAt: new Date((dayIndex + 1) * DAY_MS - IST_OFFSET_MS) };
}

const bucketKey = (vidyaId: string, dayIndex: number) => `games-free-day:${vidyaId}:${dayIndex}`;

export interface GameAllowance {
  unlimited: boolean;
  limit: number | null;
  used: number;
  remaining: number | null;
}

export async function gameAllowance(vidyaId: string): Promise<GameAllowance> {
  if (await studentPremiumSource(vidyaId)) {
    return { unlimited: true, limit: null, used: 0, remaining: null };
  }
  const { dayIndex } = istDay();
  const [row] = await db
    .select({ count: rateLimitBucketsTable.count })
    .from(rateLimitBucketsTable)
    .where(eq(rateLimitBucketsTable.key, bucketKey(vidyaId, dayIndex)))
    .limit(1);
  const used = row?.count ?? 0;
  const limit = FREE_LIMITS.studentGamesPerDay;
  return { unlimited: false, limit, used, remaining: Math.max(0, limit - used) };
}

/**
 * Use one game from today's allowance, atomically. Returns false when the day's
 * free games are already gone. If the counter itself is unavailable this lets
 * the game through: it is a product limit, not a security control.
 */
export async function consumeGame(vidyaId: string): Promise<boolean> {
  try {
    if (await studentPremiumSource(vidyaId)) return true;
    const { dayIndex, resetAt } = istDay();
    const [row] = await db
      .insert(rateLimitBucketsTable)
      .values({ key: bucketKey(vidyaId, dayIndex), count: 1, resetAt })
      .onConflictDoUpdate({
        target: rateLimitBucketsTable.key,
        set: { count: sql`${rateLimitBucketsTable.count} + 1` },
      })
      .returning({ count: rateLimitBucketsTable.count });
    return (row?.count ?? 1) <= FREE_LIMITS.studentGamesPerDay;
  } catch {
    return true;
  }
}
