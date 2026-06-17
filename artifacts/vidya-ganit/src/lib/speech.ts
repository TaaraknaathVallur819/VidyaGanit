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
