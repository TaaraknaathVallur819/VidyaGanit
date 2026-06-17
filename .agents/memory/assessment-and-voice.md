---
name: Assessment tests & voice settings
description: Product rules for topic-mastery tests and per-user voice settings that future edits must preserve
---

# Topic-mastery tests & per-user voice settings

## Assessment scoring rule (product decision)
- Graded topic tests use **points per correct answer with NO negative marking** —
  wrong/blank answers never subtract. Any change to the submit/scoring path must
  keep scores >= 0 and must not penalize incorrect answers.
- **Why:** the app is for young kids (Classes 4–7); negative marking discourages
  them. This was an explicit requirement.
- **How to apply:** when touching the assessment submit/score logic, preserve the
  no-penalty behavior; the deterministic question generators provide a fallback
  when the AI is unavailable, so scoring must work for both AI- and fallback-
  generated questions.

## Voice settings placement (consistency requirement)
- Per-user voice settings (rate/pitch/voiceName for read-aloud) must live in the
  **"My Profile" tab for all three roles** (student, parent, tutor) — not in
  other tabs (e.g. tutor's Students tab).
- **Why:** a code review already caught it mounted in the wrong tab for the tutor;
  inconsistent placement across roles is a recurring mistake here.
- **How to apply:** if you add/move VoiceSettings, mount it inside the profile
  TabsContent in each of Student/Parent/TutorDashboard, parallel to the profile card.
