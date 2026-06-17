import { ImageIcon } from "lucide-react";
import { useLanguage } from "@/lib/i18n";

export type ImageModel = "openai" | "gemini-nano-banana" | "gemini-nano-banana-pro";

// Brand/model names are intentionally hardcoded (not translated).
const IMAGE_MODELS: { value: ImageModel; label: string }[] = [
  { value: "openai", label: "gpt-image-1" },
  { value: "gemini-nano-banana", label: "Nano Banana" },
  { value: "gemini-nano-banana-pro", label: "Nano Banana Pro" },
];

export default function ImageModelSelect({
  value,
  onChange,
  disabled,
}: {
  value: ImageModel;
  onChange: (next: ImageModel) => void;
  disabled?: boolean;
}) {
  const { t } = useLanguage();
  return (
    <label
      className="flex items-center gap-1 rounded-lg border border-indigo-100 bg-white px-1.5 py-1 text-muted-foreground focus-within:border-primary transition-colors"
      title={t("chat.imageModel")}
    >
      <ImageIcon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
      <select
        aria-label={t("chat.imageModel")}
        data-testid="select-image-model"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value as ImageModel)}
        className="bg-transparent text-xs font-semibold text-foreground outline-none cursor-pointer disabled:cursor-not-allowed pr-0.5"
      >
        {IMAGE_MODELS.map((m) => (
          <option key={m.value} value={m.value}>
            {m.label}
          </option>
        ))}
      </select>
    </label>
  );
}
