---
name: api-server externalized deps must be direct deps
description: Why a transitive package matched by build.mjs `external` can crash api-server at startup, and how to fix it.
---

# Externalized packages must be direct deps of api-server

`artifacts/api-server/build.mjs` esbuild-bundles the server but lists an `external`
array (e.g. `@google/*`, `sharp`, native modules). Anything matched there is NOT
bundled and must be resolvable at runtime from `artifacts/api-server`'s own
node_modules.

**Rule:** if a workspace lib brings in an externalized package (e.g.
`integrations-gemini-ai` → `@google/genai`, matched by `@google/*`), that package
must ALSO be declared as a direct dependency of `@workspace/api-server`. A
transitive-only dep is not reliably resolvable from the artifact, so the bundled
`dist/index.mjs` crashes at startup with `ERR_MODULE_NOT_FOUND`.

**Why:** pnpm does not hoist a lib's deps into the api-server package; esbuild
would normally bundle them, but the `external` list opts them out, leaving runtime
resolution to Node from the artifact dir.

**Contrast:** `@anthropic-ai/sdk` is NOT externalized, so esbuild bundles it and it
works without being a direct api-server dep. Only externalized packages need the
explicit direct dependency.

**How to apply:** when adding a new AI provider / lib whose runtime package is
matched by the `external` list, run `pnpm --filter @workspace/api-server add <pkg>`.
