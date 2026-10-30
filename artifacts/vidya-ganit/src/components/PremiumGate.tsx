import type { ReactNode } from "react";
import { Loader2, Lock, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/lib/i18n";
import { PLAN_FOR_ROLE, hasPlanFor, usePlanStatus, type PlanRole } from "@/lib/planStatus";

/** The locked features that have a tab, keyed to their translation entries. */
export type GatedFeature =
  | "strategyAi"
  | "aiCoach"
  | "weeklyInsights"
  | "worksheets"
  | "reportCards"
  | "classHeatmap";

/**
 * Shows `children` to subscribers and an upgrade card to everyone else. This is
 * the experience layer only: the API independently answers 402 for the same
 * features, so hiding the panel here is never what keeps it locked.
 */
export default function PremiumGate({
  vidyaId,
  role,
  feature,
  children,
}: {
  vidyaId: string;
  role: PlanRole;
  feature: GatedFeature;
  children: ReactNode;
}) {
  const { t } = useLanguage();
  const status = usePlanStatus(vidyaId);

  if (status === undefined) {
    return (
      <div className="flex items-center justify-center py-16 text-indigo-500" role="status">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }
  // Could not read the plan: don't lock anyone out client-side; the API decides.
  if (status === null || hasPlanFor(status, role)) return <>{children}</>;

  const plan = PLAN_FOR_ROLE[role];
  return (
    <div
      className="rounded-3xl border-2 border-indigo-100 bg-gradient-to-br from-white via-indigo-50/40 to-violet-50/30 p-8 text-center shadow-sm"
      data-testid={`locked-feature-${role}`}
    >
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-md">
        <Lock className="h-7 w-7" />
      </div>
      <h3 className="text-xl font-black text-slate-800">
        {t("upgrade.partOf")
          .replace("{feature}", t(`feature.${feature}`))
          .replace("{plan}", plan.name)}
      </h3>
      <p className="mx-auto mt-2 max-w-md text-sm font-medium text-slate-600">
        {t(`benefit.${feature}`)}
      </p>
      <p className="mt-4 text-sm font-bold text-indigo-700">
        {t("upgrade.startsAt")
          .replace("{plan}", plan.name)
          .replace("{price}", String(plan.fromPrice))}
      </p>
      {status.paymentsEnabled ? (
        <a href="/#pricing" className="mt-5 inline-block">
          <Button className="rounded-2xl bg-indigo-600 px-6 font-bold text-white hover:bg-indigo-500">
            <Sparkles className="mr-2 h-4 w-4" />
            {t("upgrade.seePlans")}
          </Button>
        </a>
      ) : (
        <p className="mx-auto mt-5 max-w-md rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
          {t("upgrade.paymentsSoon").replace("{plan}", plan.name)}
        </p>
      )}
    </div>
  );
}

/** A small padlock for a tab label, shown only while that tab is locked. */
export function TabLock({ vidyaId, role }: { vidyaId: string; role: PlanRole }) {
  const status = usePlanStatus(vidyaId);
  if (status === undefined || status === null || hasPlanFor(status, role)) return null;
  return <Lock className="ml-1 h-3 w-3 opacity-60" aria-hidden="true" />;
}
