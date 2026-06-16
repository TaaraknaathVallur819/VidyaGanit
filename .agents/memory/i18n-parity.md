---
name: i18n parity guard
description: How VidyaGanit keeps its four language dictionaries in sync and where the check lives
---

# i18n dictionary parity (VidyaGanit web)

The web artifact ships four language dictionaries (en/ta/hi/te) in
`artifacts/vidya-ganit/src/lib/i18n.tsx`. `DICTS` is exported specifically so a
test can introspect them.

A permanent vitest test (`src/lib/i18n.test.ts`) enforces, for every non-English
dict: same key set as English (no missing, no extra/stale), no blank values, and
no longer alphabetic value left identical to the English string (untranslated
guard). English is the source of truth.

**Why:** an untranslated or orphaned key silently degrades a language without any
runtime error — only a test catches it.

**How to apply:** when adding any UI string, add the key to all four dicts. Run
`pnpm --filter @workspace/vidya-ganit run test`. The repo's `test` validation runs
`pnpm -r --if-present run test`, so this parity check runs in CI next to the
api-server suite — keep that recursive form if you touch validation config.
