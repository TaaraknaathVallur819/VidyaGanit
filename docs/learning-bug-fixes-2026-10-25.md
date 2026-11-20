# Assessment and reward fixes

Based on `main` at `0beb2e4`.

## Fixed behaviour

- Unknown assessment topics that match inherited JavaScript object properties
  (`constructor`, `toString`, `__proto__`, `hasOwnProperty`) now use the intended
  fallback generator and readable label instead of producing invalid questions
  or throwing an error.
- An assessment can transition from pending to completed only once. Concurrent
  submissions receive one successful result; competing submissions receive 409
  and cannot replace the saved answers or score.
- Game and chat rewards now calculate XP, coins, badges and chat streaks from
  the current user row inside a short transaction with a row lock. They preserve
  overlapping rewards and purchases, and do not award first-time badge bonuses
  twice. The lock is acquired after the AI response, not during generation.

No database migration or frontend change is required.

## Verification results

- 85 backend tests passed across 15 files, including five real PostgreSQL
  concurrency tests; TypeScript library/API checks and the API production build
  passed.
- Running the new regressions against the original assessment/game code produced
  six failures: four unexpected topic values, repeated assessment acceptance,
  and repeated badge awards.
- The streamed-chat test also failed against the original chat implementation:
  it saved 115 XP instead of 125, losing the overlapping game's 10 XP.
- An initial parallel test run exceeded the health suite's five-second timeout
  during Windows module loading. The complete run passed with two workers and
  a 15-second timeout, with no health-code changes.
- Tests ran locally with synthetic accounts and stubbed AI output. This is not
  an end-to-end production or browser verification.

## Regression coverage

`assessment-topics.test.ts` checks unexpected topics and a recognised topic.
`learningConcurrency.test.ts` uses real PostgreSQL and concurrent requests to
check submission finalisation, game rewards, first-time chat bonuses, streaks,
coin spending, and a streamed chat overlapping a game and purchase. AI output,
authentication and rate limiting are stubbed in that suite; it does not claim
to verify those services.

The database suite is opt-in. Without `VIDYAGANIT_TEST_DATABASE_URL`, it skips.
It rejects non-loopback hosts and databases not named `vidyaganit_regression`.
Use a dedicated disposable database, populated with the current Drizzle schema,
and no real data. The suite creates and removes a trigger to force assessment
updates to overlap, plus its own test student and dependent records.

Example after provisioning that local database (POSIX shell):

```sh
VIDYAGANIT_TEST_DATABASE_URL=postgresql://regression@127.0.0.1:55437/vidyaganit_regression \
  pnpm --filter @workspace/api-server exec vitest run \
  src/routes/learningConcurrency.test.ts src/lib/assessment-topics.test.ts \
  src/lib/assessment-fractions.test.ts src/lib/mistakes.test.ts
```

On Windows, the repository's deployment-oriented dependency overrides exclude
native Windows binaries. Local verification used matching Rollup and esbuild
Windows binaries installed in an ignored tools folder, without changing the
application's package manifests or lockfile.
