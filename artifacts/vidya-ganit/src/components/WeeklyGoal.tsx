import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Target, Trophy } from "lucide-react";
import {
  useGetWeeklygoal,
  getGetWeeklygoalQueryKey,
  useSetWeeklyGoal,
} from "@workspace/api-client-react";
import { useLanguage } from "@/lib/i18n";

const MIN_TARGET = 20;
const MAX_TARGET = 5000;
const STEP = 20;

function ProgressRing({ percent }: { percent: number }) {
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, percent));
  const offset = circumference - (clamped / 100) * circumference;
  return (
    <svg width="128" height="128" viewBox="0 0 128 128" className="shrink-0">
      <circle
        cx="64"
        cy="64"
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth="12"
        className="text-gray-100"
      />
      <motion.circle
        cx="64"
        cy="64"
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth="12"
        strokeLinecap="round"
        className="text-emerald-500"
        transform="rotate(-90 64 64)"
        strokeDasharray={circumference}
        initial={{ strokeDashoffset: circumference }}
        animate={{ strokeDashoffset: offset }}
        transition={{ duration: 0.9, ease: "easeOut" }}
      />
      <text
        x="64"
        y="64"
        textAnchor="middle"
        dominantBaseline="central"
        className="fill-foreground font-extrabold"
        style={{ fontSize: 22 }}
      >
        {Math.round(clamped)}%
      </text>
    </svg>
  );
}

export default function WeeklyGoal({ vidyaId }: { vidyaId: string }) {
  const { t } = useLanguage();
  const { data, refetch } = useGetWeeklygoal(vidyaId, {
    query: { enabled: !!vidyaId, queryKey: getGetWeeklygoalQueryKey(vidyaId) },
  });
  const setMutation = useSetWeeklyGoal();

  const [target, setTarget] = useState<number>(200);
  useEffect(() => {
    if (data?.targetXp && data.targetXp > 0) setTarget(data.targetXp);
  }, [data?.targetXp]);

  const hasGoal = (data?.targetXp ?? 0) > 0;
  const earned = data?.earnedXp ?? 0;
  const percent = data?.percent ?? 0;
  const reached = hasGoal && earned >= (data?.targetXp ?? 0);
  const remaining = Math.max(0, (data?.targetXp ?? 0) - earned);

  const clamp = (n: number) =>
    Math.min(MAX_TARGET, Math.max(MIN_TARGET, n));

  const save = () => {
    const value = clamp(target);
    setMutation.mutate(
      { vidyaId, data: { targetXp: value } },
      { onSuccess: () => refetch() },
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
    >
      <Card className="border-0 shadow-md rounded-2xl overflow-hidden">
        <CardContent className="p-6 space-y-5">
          <div className="flex items-center gap-2">
            <Target className="w-5 h-5 text-emerald-500" />
            <div>
              <h3 className="font-bold text-lg text-foreground leading-tight">
                {t("weeklyGoal.title")}
              </h3>
              <p className="text-xs text-muted-foreground">
                {t("weeklyGoal.subtitle")}
              </p>
            </div>
          </div>

          {hasGoal ? (
            <div className="flex items-center gap-5">
              <ProgressRing percent={percent} />
              <div className="min-w-0 flex-1 space-y-1.5">
                <p className="text-sm font-semibold text-foreground">
                  {t("weeklyGoal.progress")
                    .replace("{earned}", String(earned))
                    .replace("{target}", String(data?.targetXp ?? 0))}
                </p>
                {reached ? (
                  <p className="text-sm font-bold text-emerald-600 flex items-center gap-1.5">
                    <Trophy className="w-4 h-4" />
                    {t("weeklyGoal.reached")}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    {t("weeklyGoal.remaining").replace("{xp}", String(remaining))}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-2">
              {t("weeklyGoal.none")}
            </p>
          )}

          <div className="rounded-2xl bg-gray-50 border border-gray-100 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-foreground">
                {t("weeklyGoal.target")}
              </span>
              <div className="ml-auto flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-7 w-7 rounded-full"
                  aria-label="-"
                  data-testid="button-weekly-decrease"
                  disabled={setMutation.isPending || target <= MIN_TARGET}
                  onClick={() => setTarget((n) => clamp(n - STEP))}
                >
                  −
                </Button>
                <span
                  className="w-14 text-center font-bold tabular-nums"
                  data-testid="text-weekly-target"
                >
                  {target}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-7 w-7 rounded-full"
                  aria-label="+"
                  data-testid="button-weekly-increase"
                  disabled={setMutation.isPending || target >= MAX_TARGET}
                  onClick={() => setTarget((n) => clamp(n + STEP))}
                >
                  +
                </Button>
              </div>
            </div>
            <Button
              type="button"
              data-testid="button-weekly-save"
              onClick={save}
              disabled={setMutation.isPending}
              className="w-full h-11 rounded-xl font-semibold"
            >
              {setMutation.isPending ? t("weeklyGoal.saving") : t("weeklyGoal.save")}
            </Button>
            <p className="text-[11px] text-muted-foreground text-center">
              {t("weeklyGoal.hint")}
            </p>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
