import { describe, expect, it } from "vitest";
import { computeStreakOnActivity, istToday, liveStreak, shiftDate } from "./streak";

// A fixed instant: 2026-06-19 10:00 IST (= 04:30 UTC). Used so the date math is
// deterministic regardless of when the suite runs.
const NOW = new Date("2026-06-19T04:30:00.000Z");

describe("istToday", () => {
  it("returns the IST calendar date as YYYY-MM-DD", () => {
    expect(istToday(NOW)).toBe("2026-06-19");
  });

  it("rolls the date forward when UTC is still the previous day", () => {
    // 2026-06-18 20:00 UTC = 2026-06-19 01:30 IST (next IST day).
    expect(istToday(new Date("2026-06-18T20:00:00.000Z"))).toBe("2026-06-19");
  });
});

describe("shiftDate", () => {
  it("moves backward and forward by whole calendar days", () => {
    expect(shiftDate("2026-06-19", -1)).toBe("2026-06-18");
    expect(shiftDate("2026-06-19", 1)).toBe("2026-06-20");
  });

  it("crosses month and year boundaries", () => {
    expect(shiftDate("2026-03-01", -1)).toBe("2026-02-28");
    expect(shiftDate("2026-01-01", -1)).toBe("2025-12-31");
  });
});

describe("computeStreakOnActivity", () => {
  it("starts a streak at 1 for a first-ever activity", () => {
    const r = computeStreakOnActivity(
      { streakCurrent: 0, streakLongest: 0, lastActiveDate: null },
      NOW,
    );
    expect(r).toEqual({
      streakCurrent: 1,
      streakLongest: 1,
      lastActiveDate: "2026-06-19",
    });
  });

  it("is idempotent for repeated same-day activity", () => {
    const r = computeStreakOnActivity(
      { streakCurrent: 5, streakLongest: 9, lastActiveDate: "2026-06-19" },
      NOW,
    );
    expect(r).toEqual({
      streakCurrent: 5,
      streakLongest: 9,
      lastActiveDate: "2026-06-19",
    });
  });

  it("increments on consecutive-day activity and tracks the longest", () => {
    const r = computeStreakOnActivity(
      { streakCurrent: 9, streakLongest: 9, lastActiveDate: "2026-06-18" },
      NOW,
    );
    expect(r).toEqual({
      streakCurrent: 10,
      streakLongest: 10,
      lastActiveDate: "2026-06-19",
    });
  });

  it("preserves a larger longest streak when the current is rebuilding", () => {
    const r = computeStreakOnActivity(
      { streakCurrent: 2, streakLongest: 30, lastActiveDate: "2026-06-18" },
      NOW,
    );
    expect(r.streakCurrent).toBe(3);
    expect(r.streakLongest).toBe(30);
  });

  it("resets to 1 after a gap (missed at least one day)", () => {
    const r = computeStreakOnActivity(
      { streakCurrent: 12, streakLongest: 12, lastActiveDate: "2026-06-17" },
      NOW,
    );
    expect(r).toEqual({
      streakCurrent: 1,
      streakLongest: 12,
      lastActiveDate: "2026-06-19",
    });
  });
});

describe("liveStreak", () => {
  it("is 0 when the student has never been active", () => {
    expect(liveStreak(0, null, NOW)).toBe(0);
  });

  it("reports the stored streak when active today", () => {
    expect(liveStreak(7, "2026-06-19", NOW)).toBe(7);
  });

  it("reports the stored streak when active yesterday (still alive)", () => {
    expect(liveStreak(7, "2026-06-18", NOW)).toBe(7);
  });

  it("reports 0 when stale (a day was missed) without mutating state", () => {
    expect(liveStreak(7, "2026-06-17", NOW)).toBe(0);
  });
});
