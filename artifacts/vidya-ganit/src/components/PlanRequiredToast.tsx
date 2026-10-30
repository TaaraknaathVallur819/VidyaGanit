import { useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { useLanguage } from "@/lib/i18n";
import { featureNameKey } from "@/lib/planStatus";

interface PlanRequiredDetail {
  error?: string;
  featureKey?: string;
  plan?: string;
  audience?: "student";
}

const PLAN_NAMES: Record<string, string> = { family_plus: "Family Plus", tutor_pro: "Tutor Pro" };

/**
 * Listens for the "vg:plan-required" event that the API client raises whenever
 * the server answers 402 PLAN_REQUIRED, and turns it into an upgrade prompt in
 * the person's own language. A locked feature therefore never fails silently,
 * wherever it was triggered from.
 */
export default function PlanRequiredToast() {
  const { toast } = useToast();
  const { t } = useLanguage();

  useEffect(() => {
    const onPlanRequired = (e: Event) => {
      const detail = (e as CustomEvent<PlanRequiredDetail>).detail ?? {};

      // Students cannot buy a plan; the person who can is their parent or tutor.
      if (detail.audience === "student") {
        toast({ title: t("upgrade.gamesTitle"), description: t("upgrade.gamesBody") });
        return;
      }

      const nameKey = featureNameKey(detail.featureKey, detail.plan);
      const description = nameKey
        ? t("upgrade.toastBody")
            .replace("{feature}", t(nameKey))
            .replace("{plan}", PLAN_NAMES[detail.plan ?? ""] ?? "")
        : (detail.error ?? t("upgrade.toastTitle"));

      toast({
        title: t("upgrade.toastTitle"),
        description,
        action: (
          <ToastAction altText={t("upgrade.seePlansShort")} onClick={() => window.location.assign("/#pricing")}>
            {t("upgrade.seePlansShort")}
          </ToastAction>
        ),
      });
    };
    window.addEventListener("vg:plan-required", onPlanRequired);
    return () => window.removeEventListener("vg:plan-required", onPlanRequired);
  }, [toast, t]);

  return null;
}
