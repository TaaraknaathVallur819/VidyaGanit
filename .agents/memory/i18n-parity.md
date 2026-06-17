---
name: i18n parity guard
description: How VidyaGanit keeps its 23 language dictionaries in sync and where the check lives
---

# i18n dictionary parity (VidyaGanit web)

The web artifact ships 23 language dictionaries (English + the 22 official Indian
languages). English plus ta/hi/te live inline in
`artifacts/vidya-ganit/src/lib/i18n.tsx` (`const en/ta/hi/te`); the other 19 live
one-file-per-code in `src/lib/locales/<code>.ts`. `DICTS` aggregates them all and
is exported specifically so a test can introspect them. English is the key
source of truth.

A permanent vitest test (`src/lib/i18n.test.ts`) enforces, for every non-English
dict: same key set as English (no missing, no extra/stale) and no blank values.
The "value is not the English string verbatim" untranslated guard runs ONLY for
the manually verified set (`VERIFIED = ta, hi, te`) — the other 19 are allowed to
match English on short/placeholder strings.

**Why:** an untranslated or orphaned key silently degrades a language without any
runtime error — only a test catches it.

**How to apply:** when adding any UI string, add the key to ALL 23 dicts — the
inline en/ta/hi/te in `i18n.tsx` AND every `locales/<code>.ts` file. A scripted
bulk-append into each locale file (before the `};\n\nexport default dict;`
marker) is the fastest way. Run `pnpm --filter @workspace/vidya-ganit run test`.
The repo's `test` validation runs `pnpm -r --if-present run test`, so this parity
check runs in CI next to the api-server suite — keep that recursive form if you
touch validation config.
