---
name: Coins/rewards concurrency + i18n parity blind spot
description: How to make coin/XP reward grants race-safe, and why the i18n parity guard can still let broken UI ship
---

# Coin/XP reward grants must be race-safe

VidyaGanit awards coins 1:1 with XP across gamification features (daily challenge, assignments, shop). Two distinct patterns, applied per write path:

- **Idempotent one-time AWARD (daily challenge submit, assignment complete):** rely on a DB unique constraint as the source of truth — `insert(...).onConflictDoNothing().returning({id})`. A returned row means *this* call won the race and may grant the reward; empty means it was already done. Wrap the insert + the `xp/coins` increment in ONE `db.transaction` so a transient failure can't record completion without awarding (or vice-versa). Use `sql\`${col} + ${n}\`` atomic increments, never read-modify-write.
- **Balance DEBIT (shop buy):** `db.transaction` + `SELECT ... FOR UPDATE` (drizzle `.for("update")`) on the user row, then ownership/balance checks, insert purchase, atomic `coins = coins - price`. The row lock serializes concurrent buys and prevents double-spend / lost-update.

**Why:** these three exact races (double-award on concurrent submit, double-spend on concurrent buy, lost update) were flagged in code review on the first naive read-modify-write implementation.

**How to apply:** any NEW coin/reward path follows the same split — unique+onConflict(+txn) for idempotent grants, row-lock+txn for debits. The relevant unique constraints already exist (`daily_challenge_unique`, `assignment_completion_unique`, `purchase_unique`).

# i18n parity guard does NOT catch keys missing from ALL dicts

The vitest i18n parity test only checks dicts are consistent WITH EACH OTHER (same keyset, non-blank, ta/hi/te non-verbatim). It does NOT verify that keys actually *used by components* exist. A whole feature's keys can be missing from every dict and the test still passes — `t()` falls back to the raw key string, so the UI silently renders `"leaderboard.title"` etc.

**Why:** this exact bug shipped 54 student-facing keys that rendered as raw strings while all tests were green.

**How to apply:** after adding any UI strings, grep every `t("...")` call across the web `src` and diff against the keys defined in `i18n.tsx` — a 0-missing check. Consider adding this component-usage check as a permanent test.
