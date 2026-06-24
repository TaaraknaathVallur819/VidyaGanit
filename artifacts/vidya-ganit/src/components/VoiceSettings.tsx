import { useEffect, useMemo, useState } from "react";
import { Volume2, Loader2, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/lib/auth";
import { useLanguage } from "@/lib/i18n";
import { useVoices } from "@/lib/voice";
import {
  isSpeechSupported,
  voicesForLang,
  normaliseVoicePrefs,
  speak,
  stopSpeaking,
  VOICE_RATE_RANGE,
  VOICE_PITCH_RANGE,
} from "@/lib/speech";
import { useUpdateProfile } from "@workspace/api-client-react";

const DEFAULT_VOICE_VALUE = "__default__";

/**
 * Self-contained "read-aloud voice" editor shared by all three role profiles.
 * Lets the user pick a system voice (filtered to their language), tune pace and
 * tone, preview live, and persist the choice to their profile.
 */
export default function VoiceSettings() {
  const { user, setUser } = useAuth();
  const { t, lang } = useLanguage();
  const voices = useVoices();
  const update = useUpdateProfile();

  const initial = useMemo(
    () =>
      normaliseVoicePrefs({
        voiceRate: user?.voiceRate,
        voicePitch: user?.voicePitch,
        voiceName: user?.voiceName,
      }),
    [user?.voiceRate, user?.voicePitch, user?.voiceName],
  );

  const [rate, setRate] = useState(initial.rate);
  const [pitch, setPitch] = useState(initial.pitch);
  const [voiceName, setVoiceName] = useState<string | null>(initial.voiceName);
  const [saved, setSaved] = useState(false);
  const [speaking, setSpeaking] = useState(false);

  // Re-sync when the stored profile changes (e.g. after a save elsewhere).
  useEffect(() => {
    setRate(initial.rate);
    setPitch(initial.pitch);
    setVoiceName(initial.voiceName);
  }, [initial]);

  // Stop any in-flight (or pending) preview if this editor unmounts.
  useEffect(() => {
    return () => stopSpeaking();
  }, []);

  const langVoices = useMemo(
    () => voicesForLang(voices, lang),
    [voices, lang],
  );

  if (!isSpeechSupported()) {
    return (
      <p className="text-sm text-muted-foreground">{t("voice.unsupported")}</p>
    );
  }

  const preview = () => {
    setSpeaking(true);
    speak(t("voice.previewText"), {
      lang,
      rate,
      pitch,
      voiceName,
      onend: () => setSpeaking(false),
      onerror: () => setSpeaking(false),
    });
  };

  const handleSave = () => {
    if (!user) return;
    setSaved(false);
    update.mutate(
      {
        vidyaId: user.vidyaId,
        data: {
          voiceRate: rate,
          voicePitch: pitch,
          voiceName: voiceName,
        },
      },
      {
        onSuccess: (updated) => {
          setUser(updated);
          setSaved(true);
          window.setTimeout(() => setSaved(false), 2500);
        },
      },
    );
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Volume2 className="w-5 h-5 text-primary" />
        <h3 className="font-bold text-foreground">{t("voice.title")}</h3>
      </div>
      <p className="text-sm text-muted-foreground -mt-2">{t("voice.subtitle")}</p>

      {/* Voice picker */}
      <div className="space-y-2">
        <Label>{t("voice.voice")}</Label>
        <Select
          value={voiceName ?? DEFAULT_VOICE_VALUE}
          onValueChange={(v) =>
            setVoiceName(v === DEFAULT_VOICE_VALUE ? null : v)
          }
        >
          <SelectTrigger data-testid="select-voice" className="h-11 rounded-xl">
            <SelectValue placeholder={t("voice.systemDefault")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={DEFAULT_VOICE_VALUE}>
              {t("voice.systemDefault")}
            </SelectItem>
            {langVoices.map((v) => (
              <SelectItem key={v.name} value={v.name}>
                {v.name} ({v.lang})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {langVoices.length === 0 && (
          <p className="text-xs text-muted-foreground">{t("voice.noVoices")}</p>
        )}
      </div>

      {/* Rate (pace) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>{t("voice.pace")}</Label>
          <span className="text-xs font-semibold text-muted-foreground">
            {rate.toFixed(1)}×
          </span>
        </div>
        <Slider
          data-testid="slider-rate"
          value={[rate]}
          min={VOICE_RATE_RANGE.min}
          max={VOICE_RATE_RANGE.max}
          step={VOICE_RATE_RANGE.step}
          onValueChange={([v]) => setRate(v)}
        />
        <div className="flex justify-between text-[11px] text-muted-foreground">
          <span>{t("voice.slow")}</span>
          <span>{t("voice.fast")}</span>
        </div>
      </div>

      {/* Pitch (tone) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>{t("voice.tone")}</Label>
          <span className="text-xs font-semibold text-muted-foreground">
            {pitch.toFixed(1)}
          </span>
        </div>
        <Slider
          data-testid="slider-pitch"
          value={[pitch]}
          min={VOICE_PITCH_RANGE.min}
          max={VOICE_PITCH_RANGE.max}
          step={VOICE_PITCH_RANGE.step}
          onValueChange={([v]) => setPitch(v)}
        />
        <div className="flex justify-between text-[11px] text-muted-foreground">
          <span>{t("voice.low")}</span>
          <span>{t("voice.high")}</span>
        </div>
      </div>

      <div className="flex items-center gap-2 pt-1">
        <Button
          type="button"
          variant="outline"
          onClick={preview}
          data-testid="button-test-voice"
          className="gap-1.5 rounded-xl"
        >
          {speaking ? (
            <Volume2 className="w-3.5 h-3.5 animate-pulse" />
          ) : (
            <Play className="w-3.5 h-3.5" />
          )}
          {t("voice.test")}
        </Button>
        <Button
          type="button"
          onClick={handleSave}
          disabled={update.isPending}
          data-testid="button-save-voice"
          className="gap-1.5 rounded-xl font-semibold"
        >
          {update.isPending ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : null}
          {t("voice.save")}
        </Button>
        {saved && (
          <span className="text-sm font-medium text-green-600">
            {t("voice.saved")}
          </span>
        )}
      </div>
    </div>
  );
}
