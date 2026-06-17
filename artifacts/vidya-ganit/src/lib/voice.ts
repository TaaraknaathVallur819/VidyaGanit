import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import {
  getVoices,
  isSpeechSupported,
  normaliseVoicePrefs,
  type VoicePrefs,
} from "@/lib/speech";

/**
 * Reactively expose the browser's available TTS voices. The list is populated
 * asynchronously, so we subscribe to `voiceschanged` and seed with whatever is
 * already there.
 */
export function useVoices(): SpeechSynthesisVoice[] {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>(() => getVoices());

  useEffect(() => {
    if (!isSpeechSupported()) return;
    const update = () => setVoices(getVoices());
    update();
    window.speechSynthesis.addEventListener("voiceschanged", update);
    return () => {
      window.speechSynthesis.removeEventListener("voiceschanged", update);
    };
  }, []);

  return voices;
}

/**
 * The current user's saved read-aloud preferences, normalised to safe ranges.
 * Falls back to sensible defaults when logged out or unset.
 */
export function useVoicePrefs(): VoicePrefs {
  const { user } = useAuth();
  return normaliseVoicePrefs({
    voiceRate: user?.voiceRate,
    voicePitch: user?.voicePitch,
    voiceName: user?.voiceName,
  });
}
