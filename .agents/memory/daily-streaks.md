---
name: Daily streaks (IST day math)
description: How VidyaGanit streaks are measured and the stale-streak display rule
---

# Daily streaks

Streaks are measured in **Asia/Kolkata (IST) calendar days**, never UTC instants — a "day" is the IST calendar date (`YYYY-MM-DD`). Students are in India, so streak boundaries must use IST or kids lose streaks at the wrong wall-clock time.

**Two-function split (deliberate):**
- On activity, the streak is *advanced and persisted* alongside XP/badges in the chat route (same write path as practice). Same-day activity is idempotent; consecutive day → +1; a gap → reset to 1; `streakLongest` only ever grows.
- On *read*, the displayed current streak is computed live: if the last active date is neither today nor yesterday, report **0 without mutating the DB**. The stored value stays put and the next activity resets it cleanly.

**Why:** decoupling "what's stored" from "what's shown" means a missed day shows 0 immediately without needing a daily cron to expire streaks, and avoids a write on every page load.

**How to apply:** any new surface that shows a streak must run the live/stale check (today-or-yesterday), not read the raw stored number. Any new activity type that should count toward streaks must call the advance-on-activity helper, not set the column directly. Daily-goal progress (today's question count) is a separate IST-day window query and is clamped 1–50 server-side.
