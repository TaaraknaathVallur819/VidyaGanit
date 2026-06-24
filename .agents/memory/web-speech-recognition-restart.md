---
name: Web Speech recognition restart
description: Why live dictation must restart with a fresh SpeechRecognition instance
---

For continuous live (word-by-word) dictation with the Web Speech API, Chrome ENDS the session after a natural pause and fires `onend`.

**Rule:** restart by creating a NEW `SpeechRecognition` instance — never call `.start()` again on the just-ended object.

**Why:** restarting the same instance throws `InvalidStateError` in Chrome, which silently kills dictation after the first pause (user sees it "stop transcribing as you speak"). Also, `.start()` can throw a transient `InvalidStateError` while a prior session tears down, so a bounded short-delay retry is needed.

**How to apply:** keep `interimResults=true` + `continuous=true`; guard every handler with `recognitionRef.current === recognition` so stale instances can't mutate state; bound restart retries and clear the restart timer on stop/fatal-error/unmount. This lives in the shared `useLiveSpeech` hook — route all chat mics through it, don't inline `new SpeechRecognition`.
