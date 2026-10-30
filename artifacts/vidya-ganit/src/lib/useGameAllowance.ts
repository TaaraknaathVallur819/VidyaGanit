import { useCallback, useEffect, useState } from "react";

export interface GameAllowance {
  unlimited: boolean;
  limit: number | null;
  used: number;
  remaining: number | null;
}

/**
 * Today's free games for the signed-in student (unlimited when a linked parent or
 * tutor has a paid plan). The server enforces the limit when a score is
 * submitted; this lets the UI say so *before* a game starts. While it loads, or if
 * it cannot be read, nothing is blocked.
 */
export function useGameAllowance(active: boolean) {
  const [allowance, setAllowance] = useState<GameAllowance | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/games/allowance", { credentials: "same-origin" });
      if (res.ok) setAllowance((await res.json()) as GameAllowance);
    } catch {
      /* leave the last known value */
    }
  }, []);

  useEffect(() => {
    if (active) void refresh();
  }, [active, refresh]);

  const blocked = allowance !== null && !allowance.unlimited && (allowance.remaining ?? 0) <= 0;
  return { allowance, blocked, refresh };
}
