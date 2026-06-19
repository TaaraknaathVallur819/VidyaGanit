import { motion } from "framer-motion";
import {
  Loader2,
  TrendingUp,
  Sparkles,
  MessageCircle,
  BookOpen,
  ClipboardCheck,
  FileText,
  FileSpreadsheet,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  useGetOwnAnalytics,
  getGetOwnAnalyticsQueryKey,
  useListOwnAssessments,
  getListOwnAssessmentsQueryKey,
} from "@workspace/api-client-react";
import { useLanguage } from "@/lib/i18n";
import AssessmentReport from "@/components/AssessmentReport";
import { exportReportPdf, exportReportCsv } from "@/lib/exportReport";

const TOPIC_COLORS: Record<string, string> = {
  fraction: "from-rose-500 to-pink-500",
  decimal: "from-amber-500 to-orange-500",
  divide: "from-indigo-500 to-violet-600",
};

function masteryTone(mastery: number): string {
  if (mastery >= 70) return "text-green-600";
  if (mastery >= 35) return "text-amber-600";
  return "text-rose-600";
}

export default function StudentProgress({ vidyaId }: { vidyaId: string }) {
  const { t } = useLanguage();
  const { data, isLoading } = useGetOwnAnalytics(vidyaId, {
    query: {
      enabled: !!vidyaId,
      queryKey: getGetOwnAnalyticsQueryKey(vidyaId),
    },
  });
  const { data: assessments, isLoading: assessmentsLoading } = useListOwnAssessments(vidyaId, {
    query: {
      enabled: !!vidyaId,
      queryKey: getListOwnAssessmentsQueryKey(vidyaId),
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="w-6 h-6 animate-spin text-primary mr-2" />
        {t("progress.loading")}
      </div>
    );
  }

  // Be resilient to a missing/failed analytics fetch: show the empty state
  // rather than a blank page so the student always sees their Progress screen.
  const totalSessions = data?.totalSessions ?? 0;
  const totalMessages = data?.totalMessages ?? 0;
  const topics = data?.topics ?? [];
  const hasActivity = totalMessages > 0;

  const handleExportPdf = () => {
    if (!data) return;
    exportReportPdf({ t, analytics: data, assessments: assessments?.results ?? [] });
  };
  const handleExportCsv = () => {
    if (!data) return;
    exportReportCsv({ t, analytics: data, assessments: assessments?.results ?? [] });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" />
            {t("progress.title")}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">{t("progress.subtitle")}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportPdf}
            data-testid="button-export-pdf"
            className="gap-1.5 rounded-full"
          >
            <FileText className="w-4 h-4" />
            {t("report.pdf")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCsv}
            data-testid="button-export-csv"
            className="gap-1.5 rounded-full"
          >
            <FileSpreadsheet className="w-4 h-4" />
            {t("report.csv")}
          </Button>
        </div>
      </div>

      {!hasActivity ? (
        <div className="flex flex-col items-center justify-center py-12 text-center space-y-3 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
          <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
            <Sparkles className="w-6 h-6 text-gray-400" />
          </div>
          <p className="text-sm font-semibold text-muted-foreground">
            {t("progress.empty.title")}
          </p>
          <p className="text-xs text-muted-foreground max-w-xs">{t("progress.empty.hint")}</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Card className="border-0 shadow-sm rounded-2xl">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-primary shrink-0">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground leading-none">
                    {totalSessions}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t("progress.totalSessions")}
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm rounded-2xl">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center text-violet-600 shrink-0">
                  <MessageCircle className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground leading-none">
                    {totalMessages}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t("progress.totalMessages")}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="border-0 shadow-md rounded-2xl">
            <CardContent className="p-6 space-y-5">
              {topics.map((topic, i) => (
                <motion.div
                  key={topic.key}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: i * 0.08 }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-sm text-foreground">{topic.label}</span>
                    <span className={`text-sm font-bold ${masteryTone(topic.mastery)}`}>
                      {topic.mastery}%
                    </span>
                  </div>
                  <div className="h-2.5 w-full bg-gray-100 rounded-full overflow-hidden">
                    <motion.div
                      className={`h-full rounded-full bg-gradient-to-r ${
                        TOPIC_COLORS[topic.key] ?? "from-indigo-500 to-violet-600"
                      }`}
                      initial={{ width: 0 }}
                      animate={{ width: `${topic.mastery}%` }}
                      transition={{ duration: 0.6, delay: i * 0.08 }}
                    />
                  </div>
                  <div className="flex items-center gap-4 mt-1.5 text-xs text-muted-foreground">
                    <span>
                      {topic.questionsPracticed} {t("progress.questions").toLowerCase()}
                    </span>
                    <span>
                      {topic.sessions} {t("progress.sessions").toLowerCase()}
                    </span>
                  </div>
                </motion.div>
              ))}
            </CardContent>
          </Card>

          <p className="text-xs text-muted-foreground leading-relaxed px-1">
            {t("progress.note")}
          </p>
        </>
      )}

      {/* Graded test reports — shown regardless of chat activity */}
      <div className="pt-2">
        <h3 className="text-base font-bold text-foreground flex items-center gap-2 mb-3">
          <ClipboardCheck className="w-5 h-5 text-emerald-500" />
          {t("report.testReports")}
        </h3>
        <AssessmentReport
          results={assessments?.results ?? []}
          isLoading={assessmentsLoading}
          variant="kid"
        />
      </div>
    </div>
  );
}
