import { Cpu } from "lucide-react";
import { useLanguage } from "@/lib/i18n";

// Stable keys sent to the API (kept in sync with the OpenAPI `chatModel` enum
// and the server-side CHAT_MODELS catalog).
export type ChatModelKey =
  | "gemini-2.5-flash"
  | "gemini-2.5-pro";

// Brand/model names are intentionally hardcoded (not translated).
const CHAT_MODEL_GROUPS: {
  provider: string;
  models: { value: ChatModelKey; label: string }[];
}[] = [
  {
    provider: "Gemini",
    models: [
      { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
      { value: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
    ],
  },
];

// Flat list of every selectable key the UI can send. Exported so a test can
// guard against drift from the OpenAPI `chatModel` enum (the server silently
// falls back to the default model for any key it doesn't recognise).
export const CHAT_MODEL_KEYS: ChatModelKey[] = CHAT_MODEL_GROUPS.flatMap((g) =>
  g.models.map((m) => m.value),
);

export default function AiModelSelect({
  value,
  onChange,
  disabled,
}: {
  value: ChatModelKey;
  onChange: (next: ChatModelKey) => void;
  disabled?: boolean;
}) {
  const { t } = useLanguage();
  return (
    <label
      className="flex items-center gap-1 rounded-lg border border-indigo-100 bg-white px-1.5 py-1 text-muted-foreground focus-within:border-primary transition-colors"
      title={t("chat.aiModel")}
    >
      <Cpu className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
      <select
        aria-label={t("chat.aiModel")}
        data-testid="select-ai-model"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value as ChatModelKey)}
        className="bg-transparent text-xs font-semibold text-foreground outline-none cursor-pointer disabled:cursor-not-allowed pr-0.5"
      >
        {CHAT_MODEL_GROUPS.map((group) => (
          <optgroup key={group.provider} label={group.provider}>
            {group.models.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </label>
  );
}
