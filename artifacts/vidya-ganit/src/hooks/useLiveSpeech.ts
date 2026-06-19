import { useCallback, useEffect, useRef, useState } from "react";

export type SpeechErrorKind =
  | "unsupported"
  | "permission"
  | "no-speech"
  | "start"
  | "other";

// Map an app language code to the closest BCP-47 locale the browser speech
// engine understands. Unsupported scripts fall back to a sensible default so
// recognition still starts instead of throwing.
const SPEECH_LOCALES: Record<string, string> = {
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
  pa: "pa-Guru-IN",
  or: "or-IN",
  as: "as-IN",
  ne: "ne-NP",
  sa: "sa-IN",
  sd: "sd-IN",
  // Languages without dedicated speech models: use the nearest widely-supported
  // locale that shares the script so dictation still works.
  brx: "hi-IN",
  doi: "hi-IN",
  kok: "hi-IN",
  mai: "hi-IN",
  ks: "ur-IN",
  mni: "bn-IN",
  sat: "hi-IN",
};

export function speechLocale(lang: string): string {
  return SPEECH_LOCALES[lang] ?? "en-IN";
}

type Options = {
  /** App language code (e.g. "en", "hi"). Converted to a speech locale. */
  lang: string;
  /** Called continuously with the full transcript for the current session. */
  onResult: (transcript: string) => void;
  /** Called once when recognition can't proceed. */
  onError?: (kind: SpeechErrorKind) => void;
};

export type LiveSpeech = {
  isListening: boolean;
  supported: boolean;
  start: () => void;
  stop: () => void;
  toggle: () => void;
};

/**
 * Live, continuous speech-to-text built on the Web Speech API. Emits interim
 * results AS the user speaks (snappy), keeps listening across the browser's
 * silence-driven auto-stops by transparently restarting, and accumulates
 * finalized segments so nothing is lost between restarts.
 */
export function useLiveSpeech({ lang, onResult, onError }: Options): LiveSpeech {
  const [isListening, setIsListening] = useState(false);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const finalTranscriptRef = useRef("");
  // True while the user wants to keep listening. Distinguishes an intentional
  // stop from the browser auto-ending on a pause (which we restart through).
  const wantListeningRef = useRef(false);

  // Keep the latest callbacks/lang without re-creating recognition handlers.
  const onResultRef = useRef(onResult);
  const onErrorRef = useRef(onError);
  const langRef = useRef(lang);
  onResultRef.current = onResult;
  onErrorRef.current = onError;
  langRef.current = lang;

  const getCtor = useCallback((): (new () => SpeechRecognition) | null => {
    if (typeof window === "undefined") return null;
    return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null;
  }, []);

  const supported = getCtor() !== null;

  const createRecognition = useCallback((): SpeechRecognition | null => {
    const Ctor = getCtor();
    if (!Ctor) return null;
    const recognition = new Ctor();
    recognition.lang = speechLocale(langRef.current);
    recognition.interimResults = true;
    recognition.continuous = true;
    recognition.maxAlternatives = 1;

    // Handlers are bound to THIS instance. A stale instance (e.g. after the
    // user stops and quickly restarts) must never mutate state or restart, so
    // every handler first checks it is still the active recognition.
    recognition.onresult = (event: SpeechRecognitionEvent) => {
      if (recognitionRef.current !== recognition) return;
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0].transcript;
        if (result.isFinal) {
          finalTranscriptRef.current += text;
        } else {
          interim += text;
        }
      }
      onResultRef.current((finalTranscriptRef.current + interim).trimStart());
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (recognitionRef.current !== recognition) return;
      if (event.error === "no-speech" || event.error === "aborted") {
        // Transient: onend will restart while the user still wants to listen.
        return;
      }
      wantListeningRef.current = false;
      recognitionRef.current = null;
      setIsListening(false);
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        onErrorRef.current?.("permission");
      } else {
        onErrorRef.current?.("other");
      }
    };

    recognition.onend = () => {
      // Ignore the tail end of a recognition we've already replaced/stopped.
      if (recognitionRef.current !== recognition) return;
      // The engine stops itself after a pause; restart the SAME instance to
      // stay live until the user explicitly stops. Guard tight loops.
      if (wantListeningRef.current) {
        try {
          recognition.start();
          return;
        } catch {
          wantListeningRef.current = false;
        }
      }
      recognitionRef.current = null;
      setIsListening(false);
    };

    return recognition;
  }, [getCtor]);

  const stop = useCallback(() => {
    wantListeningRef.current = false;
    setIsListening(false);
    const recognition = recognitionRef.current;
    // Clear the ref FIRST so this instance's pending onend/onerror see they are
    // stale and skip restarting. abort() ends immediately without a final event.
    recognitionRef.current = null;
    recognition?.abort();
  }, []);

  const start = useCallback(() => {
    if (wantListeningRef.current) return;
    const recognition = createRecognition();
    if (!recognition) {
      onErrorRef.current?.("unsupported");
      return;
    }
    finalTranscriptRef.current = "";
    recognitionRef.current = recognition;
    wantListeningRef.current = true;
    try {
      recognition.start();
      setIsListening(true);
    } catch {
      wantListeningRef.current = false;
      recognitionRef.current = null;
      setIsListening(false);
      onErrorRef.current?.("start");
    }
  }, [createRecognition]);

  const toggle = useCallback(() => {
    if (wantListeningRef.current) stop();
    else start();
  }, [start, stop]);

  useEffect(() => {
    return () => {
      wantListeningRef.current = false;
      recognitionRef.current?.abort();
      recognitionRef.current = null;
    };
  }, []);

  return { isListening, supported, start, stop, toggle };
}
