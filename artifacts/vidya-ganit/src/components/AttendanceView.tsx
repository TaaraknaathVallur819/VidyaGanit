import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CalendarCheck } from "lucide-react";
import {
  useGetLinkedStudents,
  getGetLinkedStudentsQueryKey,
  useGetStudentAttendance,
  getGetStudentAttendanceQueryKey,
} from "@workspace/api-client-react";
import { useLanguage } from "@/lib/i18n";

export default function AttendanceView({ vidyaId }: { vidyaId: string }) {
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

  const { data } = useGetStudentAttendance(vidyaId, studentId ?? "", {
    query: {
      enabled: !!vidyaId && !!studentId,
      queryKey: getGetStudentAttendanceQueryKey(vidyaId, studentId ?? ""),
    },
  });
  const summary = data?.summary;
  const records = data?.records ?? [];

  const statusLabel = (s: string) =>
    s === "present" ? t("attendance.present") : s === "absent" ? t("attendance.absent") : t("attendance.late");
  const statusColor = (s: string) =>
    s === "present" ? "text-emerald-600" : s === "absent" ? "text-red-600" : "text-amber-600";

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      <Card className="border-0 shadow-md rounded-2xl">
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center gap-2">
            <CalendarCheck className="w-5 h-5 text-primary" />
            <div>
              <h3 className="font-bold text-lg leading-tight">{t("attendance.viewTitle")}</h3>
              <p className="text-xs text-muted-foreground">{t("attendance.viewSubtitle")}</p>
            </div>
          </div>
          {students.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">{t("attendance.noChild")}</p>
          ) : (
            <Select value={studentId ?? undefined} onValueChange={setStudentId}>
              <SelectTrigger className="w-full max-w-xs h-9 rounded-xl" data-testid="select-attendance-student">
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
          )}
        </CardContent>
      </Card>

      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Stat label={t("attendance.rate")} value={`${summary.attendancePct}%`} />
          <Stat label={t("attendance.present")} value={String(summary.present)} />
          <Stat label={t("attendance.absent")} value={String(summary.absent)} />
          <Stat label={t("attendance.late")} value={String(summary.late)} />
        </div>
      )}

      <Card className="border-0 shadow-sm rounded-2xl">
        <CardContent className="p-5 space-y-2">
          <h4 className="font-bold text-foreground">{t("attendance.records")}</h4>
          {records.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">{t("attendance.noRecords")}</p>
          ) : (
            records.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between rounded-xl bg-gray-50 border border-gray-100 p-3"
                data-testid={`row-attendance-${r.id}`}
              >
                <span className="text-sm font-medium">
                  {new Date(r.sessionDate).toLocaleDateString("en-IN")}
                </span>
                <Badge variant="outline" className={`${statusColor(r.status)} font-semibold`}>
                  {statusLabel(r.status)}
                </Badge>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card className="border-0 shadow-sm rounded-2xl">
      <CardContent className="p-4 text-center">
        <p className="text-2xl font-extrabold text-foreground tabular-nums">{value}</p>
        <p className="text-xs text-muted-foreground mt-1">{label}</p>
      </CardContent>
    </Card>
  );
}
