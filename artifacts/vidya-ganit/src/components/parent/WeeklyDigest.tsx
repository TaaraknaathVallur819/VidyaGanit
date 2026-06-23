import { useState, useEffect } from "react";
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
import {
  useGetWeeklyDigest,
  getGetWeeklyDigestQueryKey,
} from "@workspace/api-client-react";
import type { LinkedStudentProfile } from "@workspace/api-client-react";
import { useLanguage } from "@/lib/i18n";
import {
  FileText,
  MessageCircle,
  ClipboardCheck,
  Target,
  Zap,
  Flame,
  TrendingUp,
  TrendingDown,
} from "lucide-react";

function formatWeek(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function StatTile({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50 p-3 flex flex-col gap-1">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        {icon}
        <span className="text-[11px] font-medium leading-tight">{label}</span>
      </div>
      <span className="text-xl font-bold text-foreground">{value}</span>
    </div>
  );
}

export default function WeeklyDigest({
  vidyaId,
  students,
}: {
  vidyaId: string;
  students: LinkedStudentProfile[];
}) {
  const { t } = useLanguage();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (students.length === 0) {
      if (selectedId !== null) setSelectedId(null);
      return;
    }
    const valid = students.some((s) => s.vidyaId === selectedId);
    if (!valid) setSelectedId(students[0].vidyaId);
  }, [students, selectedId]);

  const studentVidyaId = selectedId ?? "";
  const { data, isLoading } = useGetWeeklyDigest(vidyaId, studentVidyaId, {
    query: {
      enabled: !!vidyaId && !!studentVidyaId,
      queryKey: getGetWeeklyDigestQueryKey(vidyaId, studentVidyaId),
    },
  });

  if (students.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
        <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center">
          <FileText className="w-7 h-7 text-gray-400" />
        </div>
        <p className="text-base font-semibold text-foreground">
          {t("digest.empty.title")}
        </p>
        <p className="text-sm text-muted-foreground max-w-sm">
          {t("digest.empty.hint")}
        </p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="space-y-5"
    >
      <div className="flex items-center gap-2">
        <FileText className="w-5 h-5 text-primary" />
        <div className="flex-1">
          <h3 className="font-bold text-lg text-foreground leading-tight">
            {t("digest.title")}
          </h3>
          <p className="text-xs text-muted-foreground">{t("digest.subtitle")}</p>
        </div>
      </div>

      <Select
        value={selectedId ?? undefined}
        onValueChange={setSelectedId}
      >
        <SelectTrigger
          className="w-full max-w-xs h-9 rounded-xl"
          data-testid="select-digest-student"
        >
          <SelectValue placeholder={t("digest.selectChild")} />
        </SelectTrigger>
        <SelectContent>
          {students.map((s) => (
            <SelectItem key={s.vidyaId} value={s.vidyaId}>
              {s.name}
              {s.studentClass ? ` · ${t("profile.class")} ${s.studentClass}` : ""}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {isLoading ? (
        <p className="text-sm text-muted-foreground text-center py-10">
          {t("digest.loading")}
        </p>
      ) : !data ? (
        <p className="text-sm text-muted-foreground text-center py-10">
          {t("digest.noData")}
        </p>
      ) : (
        <Card className="border-0 shadow-md rounded-2xl overflow-hidden">
          <CardContent className="p-6 space-y-5">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <p className="text-lg font-bold text-foreground">{data.name}</p>
                <p className="text-xs text-muted-foreground font-mono">
                  {data.studentVidyaId}
                </p>
              </div>
              <Badge variant="secondary" className="font-semibold">
                {t("digest.weekOf").replace("{date}", formatWeek(data.weekStart))}
              </Badge>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <StatTile
                icon={<MessageCircle className="w-3.5 h-3.5" />}
                label={t("digest.messages")}
                value={String(data.messages)}
              />
              <StatTile
                icon={<ClipboardCheck className="w-3.5 h-3.5" />}
                label={t("digest.testsTaken")}
                value={String(data.testsTaken)}
              />
              <StatTile
                icon={<Target className="w-3.5 h-3.5" />}
                label={t("digest.avgScore")}
                value={data.avgScore === null ? "—" : `${data.avgScore}%`}
              />
              <StatTile
                icon={<Zap className="w-3.5 h-3.5" />}
                label={t("digest.xpGained")}
                value={`+${data.xpGained}`}
              />
              <StatTile
                icon={<Flame className="w-3.5 h-3.5" />}
                label={t("digest.currentStreak")}
                value={`${data.currentStreak} ${t("digest.streakDays")}`}
              />
            </div>

            <div className="space-y-3">
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <TrendingUp className="w-4 h-4 text-green-600" />
                  <span className="text-sm font-semibold text-foreground">
                    {t("digest.topTopics")}
                  </span>
                </div>
                {data.topTopics.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    {t("digest.noTopics")}
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {data.topTopics.map((topic) => (
                      <span
                        key={topic}
                        className="text-xs font-medium px-2.5 py-1 rounded-full bg-green-50 text-green-700 border border-green-100"
                      >
                        {topic}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <TrendingDown className="w-4 h-4 text-orange-500" />
                  <span className="text-sm font-semibold text-foreground">
                    {t("digest.weakTopics")}
                  </span>
                </div>
                {data.weakTopics.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    {t("digest.noTopics")}
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {data.weakTopics.map((topic) => (
                      <span
                        key={topic}
                        className="text-xs font-medium px-2.5 py-1 rounded-full bg-orange-50 text-orange-700 border border-orange-100"
                      >
                        {topic}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </motion.div>
  );
}
