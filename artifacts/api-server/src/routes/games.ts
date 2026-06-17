import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { SubmitGameScoreBody } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";
import { rateLimit } from "../middlewares/rateLimit";

const router: IRouter = Router();

// Cap the XP a single mini-game can award so the games can't be farmed for
// unbounded XP. Games report a raw score; we convert it 1:1 up to this cap.
const MAX_GAME_XP = 50;

router.post(
  "/games/score",
  requireAuth,
  rateLimit({ windowMs: 60_000, max: 30, keyPrefix: "games-minute" }),
  rateLimit({
    windowMs: 60 * 60_000,
    max: 300,
    keyPrefix: "games-hour",
    message: "That's a lot of games! 🌟 Take a little break and come back soon.",
  }),
  async (req, res): Promise<void> => {
    const parsed = SubmitGameScoreBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    // Identity comes from the verified session cookie, never the request body.
    const vidyaId = req.vidyaId as string;
    const score = Math.max(0, Math.floor(parsed.data.score));

    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.vidyaId, vidyaId));

    if (!user) {
      res.status(404).json({ error: "Student not found" });
      return;
    }

    const xpAwarded = Math.min(score, MAX_GAME_XP);
    const currentXp = user.xp ?? 0;
    const newXp = currentXp + xpAwarded;

    const existing = new Set(user.badges ?? []);
    const newBadges: string[] = [];
    if (newXp >= 100 && currentXp < 100 && !existing.has("century_club")) {
      newBadges.push("century_club");
    }
    const allBadges = [...new Set([...(user.badges ?? []), ...newBadges])];

    await db
      .update(usersTable)
      .set({ xp: newXp, badges: allBadges })
      .where(eq(usersTable.vidyaId, vidyaId));

    res.json({ xp: newXp, xpAwarded, badges: allBadges, newBadges });
  },
);

export default router;
