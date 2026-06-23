import { useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ClipboardList, Loader2, Plus, CalendarClock, Users2 } from "lucide-react";
import {
  useListTutorAssignments,
  getListTutorAssignmentsQueryKey,
  useCreateAssignment,
  type CreateAssignmentInputKind,
} from "@workspace/api-client-react";
import { useLanguage } from "@/lib/i18n";

const KINDS: CreateAssignmentInputKind[] = ["practice", "test"];

function formatDate(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function TutorAssignments({
  vidyaId,
  batches,
}: {
  vidyaId: string;
  batches: string[];
}) {
  const { t } = useLanguage();

  const { data, isLoading, refetch } = useListTutorAssignments(vidyaId, {
    query: {
      enabled: !!vidyaId,
      queryKey: getListTutorAssignmentsQueryKey(vidyaId),
    },
  });
  const assignments = data?.assignments ?? [];

  const createMutation = useCreateAssignment();

  const [batch, setBatch] = useState<string>(batches[0] ?? "");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [kind, setKind] = useState<CreateAssignmentInputKind>("practice");
  const [topic, setTopic] = useState("");
  const [dueDate, setDueDate] = useState("");

  const hasBatches = batches.length > 0;
  const canSubmit = !!batch && !!title.trim() && !createMutation.isPending;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    createMutation.mutate(
      {
        vidyaId,
        data: {
          batch,
          title: title.trim(),
          description: description.trim() || null,
          kind,
          topic: topic.trim() || null,
          dueDate: dueDate || null,
        },
      },
      {
        onSuccess: () => {
          setTitle("");
          setDescription("");
          setTopic("");
          setDueDate("");
          setKind("practice");
          refetch();
        },
      },
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-primary" />
          {t("assign.title")}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">{t("assign.subtitle")}</p>
      </div>

      {/* Create form */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
      >
        <Card className="border-0 shadow-md rounded-2xl overflow-hidden">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-5">
              <Plus className="w-5 h-5 text-primary" />
              <h3 className="font-bold text-lg text-foreground">{t("assign.create")}</h3>
            </div>

            {!hasBatches ? (
              <p className="text-sm text-muted-foreground bg-gray-50 border border-gray-100 rounded-xl p-4">
                {t("assign.noBatches")}
              </p>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>{t("assign.batch")}</Label>
                  <Select value={batch} onValueChange={setBatch}>
                    <SelectTrigger className="h-11 rounded-xl" data-testid="select-assign-batch">
                      <SelectValue placeholder={t("assign.selectBatch")} />
                    </SelectTrigger>
                    <SelectContent>
                      {batches.map((b) => (
                        <SelectItem key={b} value={b}>
                          {b}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="assign-title">{t("assign.assignmentTitle")}</Label>
                  <Input
                    id="assign-title"
                    data-testid="input-assign-title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder={t("assign.titlePlaceholder")}
                    className="h-11"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="assign-description">
                    {t("assign.description")}{" "}
                    <span className="text-muted-foreground font-normal">
                      {t("assign.optional")}
                    </span>
                  </Label>
                  <Textarea
                    id="assign-description"
                    data-testid="input-assign-description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder={t("assign.descriptionPlaceholder")}
                    rows={3}
                    className="resize-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{t("assign.kind")}</Label>
                    <Select
                      value={kind}
                      onValueChange={(v) => setKind(v as CreateAssignmentInputKind)}
                    >
                      <SelectTrigger className="h-11 rounded-xl" data-testid="select-assign-kind">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {KINDS.map((k) => (
                          <SelectItem key={k} value={k}>
                            {t(`assign.kind.${k}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="assign-due">
                      {t("assign.dueDate")}{" "}
                      <span className="text-muted-foreground font-normal">
                        {t("assign.optional")}
                      </span>
                    </Label>
                    <Input
                      id="assign-due"
                      data-testid="input-assign-due"
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      className="h-11"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="assign-topic">
                    {t("assign.topic")}{" "}
                    <span className="text-muted-foreground font-normal">
                      {t("assign.optional")}
                    </span>
                  </Label>
                  <Input
                    id="assign-topic"
                    data-testid="input-assign-topic"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder={t("assign.topicPlaceholder")}
                    className="h-11"
                  />
                </div>

                <Button
                  type="submit"
                  data-testid="button-create-assignment"
                  disabled={!canSubmit}
                  className="w-full h-11 rounded-xl font-semibold gap-1.5"
                >
                  {createMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {t("assign.creating")}
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      {t("assign.submit")}
                    </>
                  )}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Existing assignments */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.1 }}
      >
        <Card className="border-0 shadow-md rounded-2xl overflow-hidden">
          <CardContent className="p-6">
            <h3 className="font-bold text-lg text-foreground mb-5">
              {t("assign.existing")}
            </h3>

            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : assignments.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                {t("assign.empty")}
              </p>
            ) : (
              <div className="space-y-3">
                {assignments.map((a) => {
                  const total = a.totalCount || 0;
                  const pct = total > 0 ? Math.round((a.completedCount / total) * 100) : 0;
                  return (
                    <div
                      key={a.id}
                      data-testid={`row-assignment-${a.id}`}
                      className="p-4 bg-gray-50 rounded-xl border border-gray-100"
                    >
                      <div className="flex items-start gap-3 flex-wrap">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold text-foreground text-sm">{a.title}</p>
                            <Badge variant="secondary" className="text-xs">
                              {t(`assign.kind.${a.kind}`)}
                            </Badge>
                            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                              <Users2 className="w-3 h-3" />
                              {a.batch}
                            </span>
                          </div>
                          {a.description && (
                            <p className="text-xs text-muted-foreground mt-1">{a.description}</p>
                          )}
                          <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                            {a.topic && (
                              <span className="text-xs text-muted-foreground">{a.topic}</span>
                            )}
                            {a.dueDate && (
                              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                                <CalendarClock className="w-3 h-3" />
                                {t("assign.due")}: {formatDate(a.dueDate)}
                              </span>
                            )}
                          </div>
                        </div>
                        <Badge variant="secondary" className="font-bold shrink-0">
                          {a.completedCount}/{total}
                        </Badge>
                      </div>
                      <div className="mt-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-muted-foreground">
                            {t("assign.progress")
                              .replace("{completed}", String(a.completedCount))
                              .replace("{total}", String(total))}
                          </span>
                          <span className="text-xs font-semibold text-primary">{pct}%</span>
                        </div>
                        <div className="h-2 w-full bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
