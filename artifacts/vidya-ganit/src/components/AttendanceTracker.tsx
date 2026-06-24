import { useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { CalendarCheck } from "lucide-react";
import {
  useGetTutorAttendance,
  getGetTutorAttendanceQueryKey,
  useMarkAttendance,
  type AttendanceRecordStatus,
} from "@workspace/api-client-react";
import { useLanguage } from "@/lib/i18n";

function istToday(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

const STATUSES: AttendanceRecordStatus[] = ["present", "absent", "late"];

export default function AttendanceTracker({ vidyaId }: { vidyaId: string }) {
  const { t } = useLanguage();
  const [date, setDate] = useState(istToday());

  const { data, refetch } = useGetTutorAttendance(vidyaId, {
    query: { enabled: !!vidyaId, queryKey: getGetTutorAttendanceQueryKey(vidyaId) },
  });
  const mark = useMarkAttendance();
  const summaries = data?.summaries ?? [];
  const records = data?.records ?? [];

  const markedToday = new Map(
    records.filter((r) => r.sessionDate === date).map((r) => [r.studentVidyaId, r.status]),
  );

  const setStatus = (studentVidyaId: string, status: AttendanceRecordStatus) => {
    mark.mutate(
      { vidyaId, data: { studentVidyaId, sessionDate: date, status } },
      { onSuccess: () => refetch() },
    );
  };

  const statusLabel = (s: string) =>
    s === "present" ? t("attendance.present") : s === "absent" ? t("attendance.absent") : t("attendance.late");

  const statusClass = (s: string, active: boolean) => {
    if (!active) return "border-gray-200 text-muted-foreground hover:border-primary/40";
    if (s === "present") return "border-emerald-500 bg-emerald-50 text-emerald-700";
    if (s === "absent") return "border-red-500 bg-red-50 text-red-700";
    return "border-amber-500 bg-amber-50 text-amber-700";
  };

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      <Card className="border-0 shadow-md rounded-2xl">
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center gap-2">
            <CalendarCheck className="w-5 h-5 text-primary" />
            <div>
              <h3 className="font-bold text-lg leading-tight">{t("attendance.title")}</h3>
              <p className="text-xs text-muted-foreground">{t("attendance.subtitle")}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm font-medium">{t("attendance.date")}</span>
            <Input
              type="date"
              value={date}
              max={istToday()}
              onChange={(e) => setDate(e.target.value)}
              className="w-44 h-9 rounded-xl"
              data-testid="input-attendance-date"
            />
          </div>
        </CardContent>
      </Card>

      {summaries.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">{t("attendance.noStudents")}</p>
      ) : (
        summaries.map((s) => {
          const today = markedToday.get(s.studentVidyaId);
          return (
            <Card key={s.studentVidyaId} className="border-0 shadow-sm rounded-2xl">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold text-foreground">{s.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {t("attendance.rate")}: {s.attendancePct}% · {s.present}/{s.total}
                    </p>
                  </div>
                  {s.batch && (
                    <Badge variant="outline" className="text-[10px]">
                      {s.batch}
                    </Badge>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {STATUSES.map((st) => (
                    <button
                      key={st}
                      type="button"
                      disabled={mark.isPending}
                      onClick={() => setStatus(s.studentVidyaId, st)}
                      data-testid={`button-mark-${s.studentVidyaId}-${st}`}
                      className={`rounded-xl border p-2 text-sm font-medium transition ${statusClass(st, today === st)}`}
                    >
                      {statusLabel(st)}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })
      )}
    </motion.div>
  );
}
