import { useEffect, useRef, useState } from "react";
import { Volume2, Square } from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { isSpeechSupported, speechLocale, resolveVoice } from "@/lib/speech";
import { useVoicePrefs, useVoices } from "@/lib/voice";

/**
 * A small toggle that reads the given text aloud using the browser's built-in
 * SpeechSynthesis, in the app's current language. Renders nothing when the
 * browser has no speech support. Only one utterance plays at a time across the
 * page — starting a new one cancels any other.
 */
export default function SpeakButton({
  text,
  tone = "dark",
  className = "",
}: {
  text: string;
  /** "light" sits on a coloured/dark bubble; "dark" sits on a white bubble. */
  tone?: "light" | "dark";
  className?: string;
}) {
  const { t, lang } = useLanguage();
  const prefs = useVoicePrefs();
  const voices = useVoices();
  const [speaking, setSpeaking] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Stop any in-flight speech if this button unmounts.
  useEffect(() => {
    return () => {
      if (utteranceRef.current && isSpeechSupported()) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  if (!isSpeechSupported() || !text.trim()) return null;

  const toggle = () => {
    const synth = window.speechSynthesis;
    if (speaking) {
      synth.cancel();
      setSpeaking(false);
      return;
    }
    // Cancel anything else currently being read elsewhere on the page.
    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = speechLocale(lang);
    utterance.rate = prefs.rate;
    utterance.pitch = prefs.pitch;
    const chosen = resolveVoice(voices, prefs.voiceName);
    if (chosen) utterance.voice = chosen;
    utterance.onend = () => {
      setSpeaking(false);
      utteranceRef.current = null;
    };
    utterance.onerror = () => {
      setSpeaking(false);
      utteranceRef.current = null;
    };
    utteranceRef.current = utterance;
    synth.speak(utterance);
    setSpeaking(true);
  };

  const toneClasses =
    tone === "light"
      ? speaking
        ? "text-white bg-white/20"
        : "text-white/70 hover:text-white hover:bg-white/15"
      : speaking
        ? "text-primary bg-indigo-50"
        : "text-muted-foreground hover:text-primary hover:bg-indigo-50";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={t("chat.readAloud")}
      aria-pressed={speaking}
      title={t("chat.readAloud")}
      className={`inline-flex items-center justify-center rounded-lg p-1 transition-colors ${toneClasses} ${className}`}
    >
      {speaking ? (
        <Square className="w-3.5 h-3.5" />
      ) : (
        <Volume2 className="w-3.5 h-3.5" />
      )}
    </button>
  );
}
