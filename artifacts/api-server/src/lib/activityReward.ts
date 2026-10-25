import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import type { StreakUpdate } from "./streak";

interface RewardState {
  xp: number;
  coins: number;
  badges: string[];
  streakCurrent: number;
  streakLongest: number;
  lastActiveDate: string | null;
}

/** Calculate rewards from the latest balances while holding the student's row lock. */
export async function awardActivityReward(
  vidyaId: string,
  calculate: (current: RewardState) => {
    xpGained: number;
    newBadges: string[];
    streak?: StreakUpdate;
  },
) {
  return db.transaction(async (tx) => {
    const [current] = await tx
      .select({
        xp: usersTable.xp,
        coins: usersTable.coins,
        badges: usersTable.badges,
        streakCurrent: usersTable.streakCurrent,
        streakLongest: usersTable.streakLongest,
        lastActiveDate: usersTable.lastActiveDate,
      })
      .from(usersTable)
      .where(eq(usersTable.vidyaId, vidyaId))
      .for("update");
    if (!current) return null;

    const { xpGained, newBadges, streak } = calculate(current);
    const xp = current.xp + xpGained;
    const badges = [...new Set([...current.badges, ...newBadges])];
    await tx
      .update(usersTable)
      .set({ xp, coins: current.coins + xpGained, badges, ...streak })
      .where(eq(usersTable.vidyaId, vidyaId));
    return { xp, xpAwarded: xpGained, badges, newBadges };
  });
}
