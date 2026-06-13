export const BADGES = {
  first_step: {
    id: "first_step",
    emoji: "🌟",
    name: "First Step",
    desc: "Ask your very first question!",
  },
  fraction_friend: {
    id: "fraction_friend",
    emoji: "🍕",
    name: "Fraction Friend",
    desc: "Ask about fractions",
  },
  cricket_scholar: {
    id: "cricket_scholar",
    emoji: "🏏",
    name: "Cricket Scholar",
    desc: "Ask about percentages or ratios",
  },
  geometry_genius: {
    id: "geometry_genius",
    emoji: "📐",
    name: "Geometry Genius",
    desc: "Ask about shapes and geometry",
  },
  algebra_ace: {
    id: "algebra_ace",
    emoji: "🧮",
    name: "Algebra Ace",
    desc: "Ask about algebra and equations",
  },
  hot_streak: {
    id: "hot_streak",
    emoji: "🔥",
    name: "Hot Streak",
    desc: "5 exchanges in one session!",
  },
  never_give_up: {
    id: "never_give_up",
    emoji: "💪",
    name: "Never Give Up",
    desc: "Keep going after getting stuck",
  },
  century_club: {
    id: "century_club",
    emoji: "🏆",
    name: "Century Club",
    desc: "Earn 100+ XP",
  },
} as const;

export type BadgeId = keyof typeof BADGES;

export function computeXpAndBadges({
  topic,
  message,
  currentXp,
  existingBadges,
  historyLength,
}: {
  topic: string;
  message: string;
  currentXp: number;
  existingBadges: string[];
  historyLength: number;
}): { xpGained: number; newBadges: BadgeId[] } {
  let xpGained = 10;
  const newBadges: BadgeId[] = [];
  const earned = new Set(existingBadges);

  if (historyLength === 0 && !earned.has("first_step")) {
    newBadges.push("first_step");
    xpGained += 10;
  }

  if (topic === "fraction" && !earned.has("fraction_friend")) {
    newBadges.push("fraction_friend");
    xpGained += 5;
  }
  if (
    (topic === "percent" || topic === "ratio") &&
    !earned.has("cricket_scholar")
  ) {
    newBadges.push("cricket_scholar");
    xpGained += 5;
  }
  if (topic === "geometry" && !earned.has("geometry_genius")) {
    newBadges.push("geometry_genius");
    xpGained += 5;
  }
  if (topic === "algebra" && !earned.has("algebra_ace")) {
    newBadges.push("algebra_ace");
    xpGained += 5;
  }

  const m = message.toLowerCase();
  const isGiveup =
    /i\s*(don[''t]*\s*know|give\s*up|can'?t|am\s*stuck)|just\s*tell|idk/.test(
      m,
    );
  if (isGiveup && !earned.has("never_give_up")) {
    newBadges.push("never_give_up");
    xpGained += 5;
  }

  if (historyLength >= 4 && !earned.has("hot_streak")) {
    newBadges.push("hot_streak");
    xpGained += 20;
  }

  const newTotal = currentXp + xpGained;
  if (newTotal >= 100 && currentXp < 100 && !earned.has("century_club")) {
    newBadges.push("century_club");
  }

  return { xpGained, newBadges };
}
