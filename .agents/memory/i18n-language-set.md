---
name: i18n language-code set
description: The canonical UI language-code set must stay identical across three places, or logged-in language changes 400 / AI replies wrong.
---

# Language-code set must stay in sync across three locations

VidyaGanit supports the 22 official Indian languages + English (23 codes). The
canonical code set must be identical in ALL of these, or things break:

1. `artifacts/vidya-ganit/src/lib/i18n.tsx` — `Language` union, `LANGUAGES`
   array (code + label + native name), `DICTS` map, and one default-export
   import per locale file from `src/lib/locales/<code>.ts`. `isLanguage()` is
   membership-based against `LANGUAGES`, so it auto-tracks the array.
2. `artifacts/api-server/src/lib/counselor.ts` — `CounselorLanguage` union and
   `LANGUAGE_NAMES`. `normalizeLanguage()` validates membership via
   `LANGUAGE_NAMES` and falls back to `en`.
3. `lib/api-spec/openapi.yaml` — there are **5** `language` enum sites
   (UserProfile [nullable, +null], ProfileUpdate, ChatMessageInput,
   ConsultantMessageInput, ConsultantAudioInput). After editing, run
   `pnpm --filter @workspace/api-spec run codegen` then `pnpm run typecheck:libs`.

**Why:** A logged-in user's language choice is persisted to their account via
`PATCH /profile` (Header → useUpdateProfile). If the OpenAPI `ProfileUpdate`
enum is missing a code, that PATCH 400s. If `normalizeLanguage` doesn't know a
code, the AI tutor/counselor silently replies in English.

**How to apply:** When adding/removing a UI language, update all three places
together and regenerate codegen. Per-language UI strings live one-file-per-code
in `src/lib/locales/`; the English dict inside `i18n.tsx` (`const en`) is the
source of truth for keys (~190). Missing keys fall back to English via
`DICTS[lang][key] ?? en[key] ?? key`, so partial dicts won't crash but won't be
fully translated.
