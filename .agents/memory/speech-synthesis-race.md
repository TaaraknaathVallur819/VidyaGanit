---
name: Web Speech cancel→speak race
description: Why the deferred speak() workaround must be abortable in the shared speech helper
---

The shared `speak()` helper defers `speechSynthesis.speak()` by a `setTimeout(…, 0)` after `cancel()` to work around a Chrome bug where a speak issued synchronously right after cancel is dropped.

**Rule:** that pending timer MUST be cancellable. Track it in a module-level var and expose `stopSpeaking()` (clears the timer AND calls `cancel()`). Callers' stop/unmount paths must use `stopSpeaking()`, never a bare `speechSynthesis.cancel()`.

**Why:** a bare `cancel()` does not clear the pending timeout, so a quick start→stop (or unmount) lets the deferred speak fire *after* the user stopped, restarting audio. Found in code review of the voice fix.

**How to apply:** any new caller that reads text aloud goes through `speak()` for playback and `stopSpeaking()` for stop/cleanup. Don't reintroduce inline `new SpeechSynthesisUtterance` + `synth.speak` in components.
