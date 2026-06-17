import { motion } from "framer-motion";
import { Loader2, ClipboardCheck, Trophy, Target } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { AssessmentSummary } from "@workspace/api-client-react";
import { useLanguage } from "@/lib/i18n";

function scoreTone(pct: number): string {
  if (pct >= 70) return "text-green-600";
  if (pct >= 40) return "text-amber-600";
  return "text-rose-600";
}

function scoreBg(pct: number): string {
  if (pct >= 70) return "from-green-500 to-emerald-500";
  if (pct >= 40) return "from-amber-500 to-orange-500";
  return "from-rose-500 to-pink-500";
}

/**
 * A clear, shared report of completed graded tests. Used in the student
 * dashboard (their own results), and in the parent + tutor portals (a linked
 * student's results). Purely presentational — the caller supplies the data.
 */
export default function AssessmentReport({
  results,
  isLoading,
  variant = "professional",
}: {
  results: AssessmentSummary[];
  isLoading?: boolean;
  /** "kid" softens copy/visuals for the student dashboard. */
  variant?: "professional" | "kid";
}) {
  const { t } = useLanguage();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="w-6 h-6 animate-spin text-primary mr-2" />
        {t("report.loading")}
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center space-y-3 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
        <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
          <ClipboardCheck className="w-6 h-6 text-gray-400" />
        </div>
        <p className="text-sm font-semibold text-muted-foreground">
          {variant === "kid" ? t("report.empty.kid") : t("report.empty.title")}
        </p>
        <p className="text-xs text-muted-foreground max-w-xs">
          {t("report.empty.hint")}
        </p>
      </div>
    );
  }

  const totalTests = results.length;
  const totalScore = results.reduce((s, r) => s + r.score, 0);
  const totalMax = results.reduce((s, r) => s + r.maxScore, 0);
  const avgPct = totalMax > 0 ? Math.round((totalScore / totalMax) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* Summary tiles */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="border-0 shadow-sm rounded-2xl">
          <CardContent className="p-4 text-center">
            <ClipboardCheck className="w-5 h-5 mx-auto text-primary mb-1.5" />
            <p className="text-2xl font-bold text-foreground leading-none">
              {totalTests}
            </p>
            <p className="text-[11px] text-muted-foreground mt-1">
              {t("report.testsTaken")}
            </p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm rounded-2xl">
          <CardContent className="p-4 text-center">
            <Trophy className="w-5 h-5 mx-auto text-amber-500 mb-1.5" />
            <p className="text-2xl font-bold text-foreground leading-none">
              {totalScore}
            </p>
            <p className="text-[11px] text-muted-foreground mt-1">
              {t("report.totalPoints")}
            </p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm rounded-2xl">
          <CardContent className="p-4 text-center">
            <Target className="w-5 h-5 mx-auto text-violet-500 mb-1.5" />
            <p className={`text-2xl font-bold leading-none ${scoreTone(avgPct)}`}>
              {avgPct}%
            </p>
            <p className="text-[11px] text-muted-foreground mt-1">
              {t("report.average")}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Per-test rows */}
      <Card className="border-0 shadow-md rounded-2xl">
        <CardContent className="p-4 space-y-3">
          {results.map((r, i) => {
            const pct =
              r.maxScore > 0 ? Math.round((r.score / r.maxScore) * 100) : 0;
            return (
              <motion.div
                key={r.testId}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: i * 0.05 }}
                className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-white px-3 py-2.5"
              >
                <div
                  className={`w-11 h-11 rounded-xl bg-gradient-to-br ${scoreBg(
                    pct,
                  )} flex items-center justify-center text-white text-sm font-bold shrink-0`}
                >
                  {pct}%
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">
                    {r.topicLabel}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t("report.scoreLine")
                      .replace("{correct}", String(r.correctCount))
                      .replace("{total}", String(r.totalQuestions))}
                    {" · "}
                    {new Date(r.completedAt).toLocaleDateString(undefined, {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-foreground">
                    {r.score}
                    <span className="text-xs font-medium text-muted-foreground">
                      /{r.maxScore}
                    </span>
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {t("report.points")}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
