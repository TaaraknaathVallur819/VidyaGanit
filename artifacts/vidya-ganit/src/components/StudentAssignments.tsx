import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ClipboardList, CalendarClock, User2, CheckCircle2 } from "lucide-react";
import {
  useGetStudentAssignments,
  getGetStudentAssignmentsQueryKey,
  useCompleteAssignment,
  type StudentAssignment,
} from "@workspace/api-client-react";
import { useLanguage } from "@/lib/i18n";

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function StudentAssignments({ vidyaId }: { vidyaId: string }) {
  const { t } = useLanguage();

  const { data, isLoading, refetch } = useGetStudentAssignments(vidyaId, {
    query: {
      enabled: !!vidyaId,
      queryKey: getGetStudentAssignmentsQueryKey(vidyaId),
    },
  });
  const completeMutation = useCompleteAssignment();

  const assignments = data?.assignments ?? [];

  const markDone = (a: StudentAssignment) => {
    if (!vidyaId) return;
    completeMutation.mutate(
      { vidyaId, assignmentId: a.id },
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
            <ClipboardList className="w-5 h-5 text-indigo-500" />
            <div>
              <h3 className="font-bold text-lg text-foreground leading-tight">
                {t("assign.title")}
              </h3>
              <p className="text-xs text-muted-foreground">
                {t("assign.subtitle")}
              </p>
            </div>
          </div>

          {isLoading ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              {t("assign.loading")}
            </p>
          ) : assignments.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              {t("assign.empty")}
            </p>
          ) : (
            <div className="space-y-3">
              {assignments.map((a) => {
                const done = a.status === "completed";
                return (
                  <div
                    key={a.id}
                    data-testid={`card-assignment-${a.id}`}
                    className={`rounded-2xl border p-4 space-y-2 ${
                      done
                        ? "bg-emerald-50/50 border-emerald-100"
                        : "bg-gray-50 border-gray-100"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-sm font-bold text-foreground">
                        {a.title}
                      </h4>
                      <Badge
                        variant={done ? "secondary" : "outline"}
                        className={`shrink-0 ${done ? "bg-emerald-100 text-emerald-700" : ""}`}
                      >
                        {done
                          ? t("assign.statusCompleted")
                          : t("assign.statusPending")}
                      </Badge>
                    </div>

                    {a.description && (
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {a.description}
                      </p>
                    )}

                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant="outline" className="font-medium capitalize">
                        {a.kind}
                      </Badge>
                      {a.topic && (
                        <span>
                          {t("assign.topic")}: {a.topic}
                        </span>
                      )}
                      {a.dueDate && (
                        <span className="flex items-center gap-1">
                          <CalendarClock className="w-3.5 h-3.5" />
                          {t("assign.due")}: {formatDate(a.dueDate)}
                        </span>
                      )}
                      {a.tutorName && (
                        <span className="flex items-center gap-1">
                          <User2 className="w-3.5 h-3.5" />
                          {a.tutorName}
                        </span>
                      )}
                    </div>

                    {!done ? (
                      <Button
                        type="button"
                        size="sm"
                        data-testid={`button-assignment-complete-${a.id}`}
                        disabled={completeMutation.isPending}
                        onClick={() => markDone(a)}
                        className="rounded-full"
                      >
                        {completeMutation.isPending
                          ? t("assign.marking")
                          : t("assign.markDone")}
                      </Button>
                    ) : (
                      <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-semibold">
                        <CheckCircle2 className="w-4 h-4" />
                        {t("assign.statusCompleted")}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
