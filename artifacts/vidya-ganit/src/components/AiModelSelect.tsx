import { Cpu } from "lucide-react";
import { useLanguage } from "@/lib/i18n";

export type ChatProvider = "openai" | "anthropic" | "gemini";

// Brand names are intentionally hardcoded (not translated).
const PROVIDERS: { value: ChatProvider; label: string }[] = [
  { value: "openai", label: "OpenAI" },
  { value: "anthropic", label: "Claude" },
  { value: "gemini", label: "Gemini" },
];

export default function AiModelSelect({
  value,
  onChange,
  disabled,
}: {
  value: ChatProvider;
  onChange: (next: ChatProvider) => void;
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
        onChange={(e) => onChange(e.target.value as ChatProvider)}
        className="bg-transparent text-xs font-semibold text-foreground outline-none cursor-pointer disabled:cursor-not-allowed pr-0.5"
      >
        {PROVIDERS.map((p) => (
          <option key={p.value} value={p.value}>
            {p.label}
          </option>
        ))}
      </select>
    </label>
  );
}
