import { motion } from "framer-motion";
import { Lightbulb, ArrowRight, Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import {
  useGetStudentRecommendation,
  getGetStudentRecommendationQueryKey,
} from "@workspace/api-client-react";
import { useLanguage } from "@/lib/i18n";

const REASON_KEY: Record<string, string> = {
  not_started: "recommend.reason.not_started",
  needs_practice: "recommend.reason.needs_practice",
  low_score: "recommend.reason.low_score",
  next_up: "recommend.reason.next_up",
};

const REASON_TONE: Record<string, string> = {
  not_started: "bg-indigo-50 text-indigo-600",
  needs_practice: "bg-amber-50 text-amber-600",
  low_score: "bg-rose-50 text-rose-600",
  next_up: "bg-emerald-50 text-emerald-600",
};

export default function RecommendedLesson({
  vidyaId,
  studentVidyaId,
}: {
  vidyaId: string;
  studentVidyaId: string;
}) {
  const { t } = useLanguage();
  const { data, isLoading } = useGetStudentRecommendation(vidyaId, studentVidyaId, {
    query: {
      enabled: !!vidyaId && !!studentVidyaId,
      queryKey: getGetStudentRecommendationQueryKey(vidyaId, studentVidyaId),
    },
  });

  // Stay quiet while loading or when there is genuinely nothing to surface.
  // (When every topic is mastered we still show the positive completion banner,
  // even though the recommendations list is empty for the top class.)
  if (isLoading || !data || (data.recommendations.length === 0 && !data.allMastered))
    return null;

  return (
    <Card className="border-0 shadow-md rounded-2xl overflow-hidden">
      <div className="h-1.5 bg-gradient-to-r from-amber-400 via-orange-400 to-rose-400" />
      <CardContent className="p-5 space-y-4">
        <div className="flex items-start gap-2">
          <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center text-amber-500 shrink-0">
            <Lightbulb className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-foreground">{t("recommend.title")}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">{t("recommend.subtitle")}</p>
          </div>
        </div>

        {data.allMastered && (
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-600 bg-emerald-50 rounded-xl px-3 py-2">
            <Sparkles className="w-4 h-4 shrink-0" />
            {t("recommend.allMastered")}
          </div>
        )}

        <div className="space-y-2.5">
          {data.recommendations.map((rec, i) => (
            <motion.div
              key={rec.unitId}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.07 }}
              className="flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50/70 p-3"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm text-foreground">{rec.title}</span>
                  <span
                    className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                      REASON_TONE[rec.reason] ?? "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {t(REASON_KEY[rec.reason] ?? "recommend.reason.needs_practice")}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
                  <ArrowRight className="w-3.5 h-3.5 text-primary shrink-0" />
                  <span className="font-medium text-foreground/80">{t("recommend.focus")}:</span>
                  {rec.lesson}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
