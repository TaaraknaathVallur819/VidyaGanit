---
name: password reset security invariants
description: Non-obvious safety rules for VidyaGanit's forgot/reset password flow
---

# Password reset flow (VidyaGanit api-server)

`POST /auth/forgot-password` + `POST /auth/reset-password` in
`artifacts/api-server/src/routes/auth.ts`. Token is random 32 bytes; only its
SHA-256 hash + expiry are stored on the user row; reset consumes (nulls) them.

## Invariants that MUST hold (each one prevents account takeover / enumeration)

1. The reset link is sent ONLY to the account's **stored** `contact`, never to
   the contact value supplied in the request body. Sending to the request value
   lets anyone redirect a reset to an address they control.
2. A link is sent only when the account exists AND has a non-null stored contact
   AND the supplied contact matches it. Accounts with `contact = null` (e.g. most
   student accounts) must NOT get a reset link — earlier code skipped the match
   check when stored contact was null, which was the takeover bug.
3. The endpoint returns an identical generic 200 message in every branch (found /
   not-found / no-contact / mismatch). No 404, no role/existence signal —
   otherwise it leaks which IDs are real.

**Why:** these were flagged in code review as a critical account-takeover +
enumeration vector. Keep all three together; relaxing any one reopens the hole.

**How to apply:** if you add SMS, alternate recovery factors, or change the
contact model, re-check that the link destination still comes from verified
server-side data, not client input, and that responses stay uniform.
