import type { Language } from "./i18n";

/**
 * Best-effort BCP-47 voice hints for browser SpeechSynthesis, keyed by our app
 * language codes. Several scheduled Indian languages have no dedicated TTS voice
 * in any browser; those fall back to a closely related language so the spoken
 * output is still intelligible (the browser picks its default voice when the
 * requested locale is unavailable).
 */
export const SPEECH_LOCALES: Record<Language, string> = {
  en: "en-IN",
  hi: "hi-IN",
  bn: "bn-IN",
  mr: "mr-IN",
  te: "te-IN",
  ta: "ta-IN",
  gu: "gu-IN",
  ur: "ur-IN",
  kn: "kn-IN",
  ml: "ml-IN",
  pa: "pa-IN",
  or: "or-IN",
  as: "as-IN",
  brx: "hi-IN", // Bodo — no TTS voice; nearest Devanagari fallback
  doi: "hi-IN", // Dogri — no TTS voice; nearest fallback
  ks: "ur-IN", // Kashmiri — Perso-Arabic; Urdu fallback
  kok: "mr-IN", // Konkani — Marathi fallback
  mai: "hi-IN", // Maithili — Hindi fallback
  mni: "bn-IN", // Manipuri (Meitei) — Bengali-script fallback
  ne: "ne-NP",
  sa: "hi-IN", // Sanskrit — Devanagari; Hindi voice fallback
  sat: "hi-IN", // Santali — no TTS voice; fallback
  sd: "ur-IN", // Sindhi — Urdu fallback
};

export function speechLocale(lang: Language): string {
  return SPEECH_LOCALES[lang] ?? "en-IN";
}

export function isSpeechSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "speechSynthesis" in window &&
    typeof window.SpeechSynthesisUtterance !== "undefined"
  );
}

/** Saved per-user read-aloud preferences. */
export type VoicePrefs = {
  /** Speaking pace, 0.5–2 (1 = normal). */
  rate: number;
  /** Tone/pitch, 0–2 (1 = normal). */
  pitch: number;
  /** Chosen system voice name, or null for the browser default. */
  voiceName: string | null;
};

export const DEFAULT_VOICE_PREFS: VoicePrefs = {
  rate: 1,
  pitch: 1,
  voiceName: null,
};

export const VOICE_RATE_RANGE = { min: 0.5, max: 2, step: 0.1 } as const;
export const VOICE_PITCH_RANGE = { min: 0, max: 2, step: 0.1 } as const;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Normalise raw (possibly nullish) values from the user profile into safe
 * SpeechSynthesis ranges, so a missing/garbage value never breaks playback.
 */
export function normaliseVoicePrefs(raw: {
  voiceRate?: number | null;
  voicePitch?: number | null;
  voiceName?: string | null;
}): VoicePrefs {
  return {
    rate:
      typeof raw.voiceRate === "number"
        ? clamp(raw.voiceRate, VOICE_RATE_RANGE.min, VOICE_RATE_RANGE.max)
        : DEFAULT_VOICE_PREFS.rate,
    pitch:
      typeof raw.voicePitch === "number"
        ? clamp(raw.voicePitch, VOICE_PITCH_RANGE.min, VOICE_PITCH_RANGE.max)
        : DEFAULT_VOICE_PREFS.pitch,
    voiceName: raw.voiceName ?? null,
  };
}

/**
 * The browser populates the voice list asynchronously, so callers should react
 * to `voiceschanged`. Returns whatever is available right now (possibly empty).
 */
export function getVoices(): SpeechSynthesisVoice[] {
  if (!isSpeechSupported()) return [];
  return window.speechSynthesis.getVoices();
}

/**
 * Voices whose locale matches the app language's BCP-47 base (e.g. "hi" for
 * "hi-IN"). When none match, returns all voices so the user can still pick one.
 */
export function voicesForLang(
  voices: SpeechSynthesisVoice[],
  lang: Language,
): SpeechSynthesisVoice[] {
  const base = speechLocale(lang).split("-")[0].toLowerCase();
  const matched = voices.filter((v) =>
    v.lang.toLowerCase().startsWith(base),
  );
  return matched.length > 0 ? matched : voices;
}

/** Resolve a saved voice name to a live voice object, if still available. */
export function resolveVoice(
  voices: SpeechSynthesisVoice[],
  voiceName: string | null,
): SpeechSynthesisVoice | undefined {
  if (!voiceName) return undefined;
  return voices.find((v) => v.name === voiceName);
}

/** Options for the shared {@link speak} helper. */
export interface SpeakOptions {
  lang: Language;
  rate?: number;
  pitch?: number;
  voiceName?: string | null;
  onend?: () => void;
  onerror?: () => void;
}

// The Chrome cancel→speak race is worked around by deferring speak() a tick.
// That pending timer is tracked here so a stop/unmount issued in between can
// abort it — otherwise the deferred speak fires after cancel and restarts audio.
let pendingSpeakTimer: number | null = null;

function clearPendingSpeak(): void {
  if (pendingSpeakTimer !== null) {
    window.clearTimeout(pendingSpeakTimer);
    pendingSpeakTimer = null;
  }
}

/** Stop any current or pending speech (cancels the deferred-speak race timer). */
export function stopSpeaking(): void {
  if (!isSpeechSupported()) return;
  clearPendingSpeak();
  window.speechSynthesis.cancel();
}

/**
 * Speak text aloud robustly across browsers and languages. Resolves a concrete
 * voice (preferred name → language match → any available) so a language whose
 * BCP-47 locale has no installed voice still produces audible output instead of
 * silently doing nothing. Also works around the Chrome bug where a speak() call
 * issued synchronously right after cancel() is dropped. Returns the utterance
 * (or null when speech is unsupported / the text is empty).
 */
export function speak(
  text: string,
  opts: SpeakOptions,
): SpeechSynthesisUtterance | null {
  if (!isSpeechSupported() || !text.trim()) return null;
  const synth = window.speechSynthesis;
  clearPendingSpeak();
  synth.cancel();
  const voices = getVoices();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = opts.rate ?? 1;
  utterance.pitch = opts.pitch ?? 1;
  const chosen =
    resolveVoice(voices, opts.voiceName ?? null) ??
    voicesForLang(voices, opts.lang)[0] ??
    voices[0];
  if (chosen) {
    utterance.voice = chosen;
    utterance.lang = chosen.lang;
  } else {
    utterance.lang = speechLocale(opts.lang);
  }
  if (opts.onend) utterance.onend = opts.onend;
  if (opts.onerror) utterance.onerror = opts.onerror;
  // Chrome drops a speak() issued synchronously right after cancel(); deferring
  // it by a tick (and resuming a possibly-paused queue) makes playback reliable.
  // The timer id is tracked so stopSpeaking() can abort a not-yet-fired speak.
  pendingSpeakTimer = window.setTimeout(() => {
    pendingSpeakTimer = null;
    synth.resume();
    synth.speak(utterance);
  }, 0);
  return utterance;
}
