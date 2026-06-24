---
name: Orval/OpenAPI codegen gotchas (VidyaGanit)
description: Non-obvious ways the OpenAPI spec shape changes generated zod/TS types and breaks downstream Drizzle inserts
---

# `format: date` on a string field generates a Date-typed zod schema

Adding `format: date` (or `date-time`) to an OpenAPI string property makes the generated `@workspace/api-zod` schema coerce that field to a JS `Date` (the inferred TS type becomes `Date`, not `string`).

**Why this bites:** Drizzle `date()` columns declared with `{ mode: "string" }` (the convention in `lib/db`) expect a `string` on insert. So a route that does `db.insert(...).values({ paidOn: body.data.paidOn })` after `safeParse` will fail typecheck with TS2769 ("Type 'Date | null' is not assignable to type 'string | ...'"). Tests can still pass (vitest doesn't typecheck) — only `pnpm run typecheck` catches it.

**How to apply:** for date fields that round-trip as ISO strings through a string-mode Drizzle column, leave the OpenAPI property as a plain nullable/required `string` (no `format: date`). Keep validation that *is* safe to add: `minimum`/`maximum` on integers and `maxLength` on strings generate plain `.min()/.max()/.max(len)` zod with no type change. Always run the full `pnpm run typecheck` (not just tests) after any `codegen` re-run.
