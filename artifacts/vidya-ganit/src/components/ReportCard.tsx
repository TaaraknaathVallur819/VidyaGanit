import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FileText, Download, Flame, Star } from "lucide-react";
import {
  useGetLinkedStudents,
  getGetLinkedStudentsQueryKey,
  useGetReportCard,
  getGetReportCardQueryKey,
} from "@workspace/api-client-react";
import { useLanguage } from "@/lib/i18n";
import { exportReportCardPdf } from "@/lib/reportCardPdf";

export default function ReportCard({ vidyaId }: { vidyaId: string }) {
  const { t } = useLanguage();
  const [studentId, setStudentId] = useState<string | null>(null);

  const { data: linked } = useGetLinkedStudents(vidyaId, {
    query: { enabled: !!vidyaId, queryKey: getGetLinkedStudentsQueryKey(vidyaId) },
  });
  const students = linked?.students ?? [];

  useEffect(() => {
    if (students.length === 0) return;
    if (!studentId || !students.some((s) => s.vidyaId === studentId)) {
      setStudentId(students[0].vidyaId);
    }
  }, [students, studentId]);

  const { data: report, isLoading } = useGetReportCard(studentId ?? "", {
    query: { enabled: !!studentId, queryKey: getGetReportCardQueryKey(studentId ?? "") },
  });

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      <Card className="border-0 shadow-md rounded-2xl">
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            <div>
              <h3 className="font-bold text-lg leading-tight">{t("reportcard.title")}</h3>
              <p className="text-xs text-muted-foreground">{t("reportcard.subtitle")}</p>
            </div>
          </div>

          {students.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">{t("reportcard.noStudents")}</p>
          ) : (
            <div className="flex items-center gap-3 flex-wrap">
              <Select value={studentId ?? undefined} onValueChange={setStudentId}>
                <SelectTrigger className="w-full max-w-xs h-9 rounded-xl" data-testid="select-report-student">
                  <SelectValue placeholder={t("reportcard.pickStudent")} />
                </SelectTrigger>
                <SelectContent>
                  {students.map((s) => (
                    <SelectItem key={s.vidyaId} value={s.vidyaId}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                disabled={!report}
                onClick={() => report && exportReportCardPdf(t, report)}
                className="rounded-full gap-2"
                data-testid="button-download-report"
              >
                <Download className="w-4 h-4" />
                {t("reportcard.download")}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {isLoading && (
        <p className="text-sm text-muted-foreground text-center py-6">{t("reportcard.loading")}</p>
      )}

      {report && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label={t("reportcard.totalTests")} value={String(report.totalTests)} />
            <StatCard label={t("reportcard.avgScore")} value={`${report.averageScorePct}%`} />
            <StatCard label="XP" value={String(report.xp)} icon={<Star className="w-4 h-4 text-amber-500" />} />
            <StatCard
              label={t("reportcard.streak")}
              value={String(report.streakLongest)}
              icon={<Flame className="w-4 h-4 text-orange-500" />}
            />
          </div>

          <Card className="border-0 shadow-sm rounded-2xl">
            <CardContent className="p-5 space-y-3">
              <h4 className="font-bold text-foreground">{t("reportcard.byTopic")}</h4>
              {report.topics.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">{t("reportcard.noTests")}</p>
              ) : (
                report.topics.map((tp) => (
                  <div key={tp.topic} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">{tp.label}</span>
                      <span className="tabular-nums text-muted-foreground">
                        {tp.avgScorePct}% · {tp.attempts}×
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                      <div
                        className={`h-full ${tp.avgScorePct >= 60 ? "bg-emerald-500" : "bg-amber-500"}`}
                        style={{ width: `${tp.avgScorePct}%` }}
                      />
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </>
      )}
    </motion.div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <Card className="border-0 shadow-sm rounded-2xl">
      <CardContent className="p-4 text-center">
        <div className="flex items-center justify-center gap-1">
          {icon}
          <span className="text-2xl font-extrabold text-foreground tabular-nums">{value}</span>
        </div>
        <p className="text-xs text-muted-foreground mt-1">{label}</p>
      </CardContent>
    </Card>
  );
}
