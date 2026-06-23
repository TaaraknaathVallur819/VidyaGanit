import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Target, Trophy } from "lucide-react";
import {
  useGetStudentWeeklyGoal,
  getGetStudentWeeklyGoalQueryKey,
} from "@workspace/api-client-react";
import { useLanguage } from "@/lib/i18n";

export default function ParentWeeklyGoal({
  vidyaId,
  studentVidyaId,
  studentName,
}: {
  vidyaId: string;
  studentVidyaId: string;
  studentName: string;
}) {
  const { t } = useLanguage();
  const { data } = useGetStudentWeeklyGoal(vidyaId, studentVidyaId, {
    query: {
      enabled: !!vidyaId && !!studentVidyaId,
      queryKey: getGetStudentWeeklyGoalQueryKey(vidyaId, studentVidyaId),
    },
  });

  const hasGoal = (data?.targetXp ?? 0) > 0;
  const earned = data?.earnedXp ?? 0;
  const target = data?.targetXp ?? 0;
  const percent = Math.max(0, Math.min(100, data?.percent ?? 0));
  const reached = hasGoal && earned >= target;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
    >
      <Card className="border-0 shadow-md rounded-2xl overflow-hidden">
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Target className="w-5 h-5 text-emerald-500" />
            <div>
              <h3 className="font-bold text-lg text-foreground leading-tight">
                {t("weeklyGoal.parentTitle").replace("{name}", studentName)}
              </h3>
              <p className="text-xs text-muted-foreground">
                {t("weeklyGoal.parentSubtitle")}
              </p>
            </div>
          </div>

          {hasGoal ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-foreground">
                  {t("weeklyGoal.progress")
                    .replace("{earned}", String(earned))
                    .replace("{target}", String(target))}
                </span>
                {reached ? (
                  <Badge className="gap-1 font-bold" data-testid="badge-child-goal-reached">
                    <Trophy className="w-3.5 h-3.5" />
                    {t("weeklyGoal.reached")}
                  </Badge>
                ) : (
                  <span className="text-sm font-bold text-emerald-600 tabular-nums">
                    {Math.round(percent)}%
                  </span>
                )}
              </div>
              <div className="h-3 rounded-full bg-gray-100 overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-emerald-500"
                  initial={{ width: 0 }}
                  animate={{ width: `${percent}%` }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                  data-testid="bar-child-goal"
                />
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-2">
              {t("weeklyGoal.parentNone").replace("{name}", studentName)}
            </p>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
