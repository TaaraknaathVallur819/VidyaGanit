---
name: i18n inject script dedup bug
description: Why ta/hi/te can silently miss keys when bulk-injecting VidyaGanit i18n strings
---

The one-off injector `.local/scripts/inject_i18n.mjs` dedups with a **whole-file** `text.includes("\"key\":")` check. `i18n.tsx` holds FOUR dicts in one file (`en`/`ta`/`hi`/`te`), processed in that order. Once `en` gets a key, every later dict sees it as "already present" and is skipped — so `en` ends up with the keys but `ta`/`hi`/`te` do NOT.

**Why:** the parity test (`i18n.test.ts`) then fails for exactly `hi`/`ta`/`te` ("has no missing keys vs. English") while the 19 separate locale files (one dict per file) pass fine.

**How to apply:** after running the injector, if the parity test fails only for ta/hi/te, re-inject those three with a **block-scoped** dedup — slice each `const <lang>: Dict = {\n ... \n};` block and check `includes` only within that block, then insert. Don't trust the injector's idempotency for multi-dict files.
