import { and, eq, gte, lte } from "drizzle-orm";
import { db, chatMessagesTable } from "@workspace/db";

// Streaks are measured in IST calendar days because the students are in India.
// A "day" is a calendar date in Asia/Kolkata, not a UTC instant.
const IST_TZ = "Asia/Kolkata";

// Returns the current IST calendar date as a YYYY-MM-DD string.
export function istToday(now: Date = new Date()): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", { timeZone: IST_TZ }).format(now);
}

// Returns the YYYY-MM-DD that is `delta` days away from `dateStr` (delta may be
// negative). Operates on the calendar date only, so it is DST-safe.
export function shiftDate(dateStr: string, delta: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + delta);
  return dt.toISOString().slice(0, 10);
}

export interface StreakUpdate {
  streakCurrent: number;
  streakLongest: number;
  lastActiveDate: string;
}

// Given a student's existing streak state, compute the new streak after activity
// happening "now". Same-day activity is idempotent; consecutive-day activity
// extends the streak; a gap resets it to 1.
export function computeStreakOnActivity(
  prev: {
    streakCurrent: number;
    streakLongest: number;
    lastActiveDate: string | null;
  },
  now: Date = new Date(),
): StreakUpdate {
  const today = istToday(now);
  const last = prev.lastActiveDate;

  if (last === today) {
    return {
      streakCurrent: prev.streakCurrent,
      streakLongest: prev.streakLongest,
      lastActiveDate: today,
    };
  }

  const yesterday = shiftDate(today, -1);
  const nextCurrent = last === yesterday ? prev.streakCurrent + 1 : 1;
  const nextLongest = Math.max(prev.streakLongest, nextCurrent);

  return {
    streakCurrent: nextCurrent,
    streakLongest: nextLongest,
    lastActiveDate: today,
  };
}

// A streak is only "live" if the student practised today or yesterday. If the
// stored streak is stale (they missed a day), report it as 0 without mutating
// the DB — the next activity will reset it via computeStreakOnActivity.
export function liveStreak(
  streakCurrent: number,
  lastActiveDate: string | null,
  now: Date = new Date(),
): number {
  if (!lastActiveDate) return 0;
  const today = istToday(now);
  if (lastActiveDate === today || lastActiveDate === shiftDate(today, -1)) {
    return streakCurrent;
  }
  return 0;
}

// Count how many questions (student-authored chat messages) a student has asked
// today, in IST. Used to show progress toward the daily goal.
export async function countTodayQuestions(
  studentVidyaId: string,
  now: Date = new Date(),
): Promise<number> {
  const today = istToday(now);
  const start = new Date(`${today}T00:00:00+05:30`);
  const end = new Date(`${today}T23:59:59.999+05:30`);

  const rows = await db
    .select({ id: chatMessagesTable.id })
    .from(chatMessagesTable)
    .where(
      and(
        eq(chatMessagesTable.studentVidyaId, studentVidyaId),
        eq(chatMessagesTable.role, "user"),
        gte(chatMessagesTable.createdAt, start),
        lte(chatMessagesTable.createdAt, end),
      ),
    );

  return rows.length;
}
