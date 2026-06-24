import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FileText, Download } from "lucide-react";
import {
  useGetWorksheet,
  useGetLinkedStudents,
} from "@workspace/api-client-react";
import { exportWorksheetPdf } from "@/lib/worksheetPdf";
import { useLanguage } from "@/lib/i18n";
import { topicsForClass, TOPIC_I18N } from "@/lib/worksheetTopics";

const COUNTS = [5, 10, 15, 20];

export default function WorksheetGenerator({ vidyaId }: { vidyaId: string }) {
  const { t } = useLanguage();
  const [selectedStudentId, setSelectedStudentId] = useState<string>("");
  const [topic, setTopic] = useState("");
  const [count, setCount] = useState(10);
  const [error, setError] = useState("");

  const { data: linkedData } = useGetLinkedStudents(vidyaId);
  const students = linkedData?.students ?? [];
  const selectedStudent =
    students.find((s) => s.vidyaId === selectedStudentId) ?? null;
  const klass = selectedStudent?.studentClass ?? null;
  const board = selectedStudent?.board ?? null;
  const topics = topicsForClass(klass);

  // Default to the first linked student once they load.
  useEffect(() => {
    if (!selectedStudentId && students.length > 0) {
      setSelectedStudentId(students[0].vidyaId);
    }
  }, [students, selectedStudentId]);

  // Keep the chosen topic valid for the selected student's class curriculum.
  useEffect(() => {
    if (!topics.includes(topic as never)) {
      setTopic(topics[0]);
    }
  }, [topics, topic]);

  const worksheetMutation = useGetWorksheet();

  const generate = () => {
    setError("");
    worksheetMutation.mutate(
      {
        vidyaId,
        data: { topic, count, klass },
      },
      {
        onSuccess: (data) =>
          exportWorksheetPdf(t, data, {
            studentName: selectedStudent?.name ?? null,
            board,
          }),
        onError: () => setError(t("worksheet.error")),
      },
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
            <FileText className="w-5 h-5 text-sky-500" />
            <div>
              <h3 className="font-bold text-lg text-foreground leading-tight">
                {t("worksheet.title")}
              </h3>
              <p className="text-xs text-muted-foreground">
                {t("worksheet.subtitle")}
              </p>
            </div>
          </div>

          {students.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("worksheet.noStudents")}
            </p>
          ) : (
            <>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">
                  {t("worksheet.student")}
                </Label>
                <Select
                  value={selectedStudentId}
                  onValueChange={setSelectedStudentId}
                >
                  <SelectTrigger
                    data-testid="select-worksheet-student"
                    className="h-11 rounded-xl"
                  >
                    <SelectValue placeholder={t("worksheet.selectStudent")} />
                  </SelectTrigger>
                  <SelectContent>
                    {students.map((s) => (
                      <SelectItem key={s.vidyaId} value={s.vidyaId}>
                        {s.name}
                        {s.studentClass ? ` · ${s.studentClass}` : ""}
                        {s.board ? ` · ${s.board}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedStudent && (
                  <p className="text-xs text-muted-foreground pt-0.5">
                    {t("worksheet.tailoredNote").replace(
                      "{name}",
                      selectedStudent.name,
                    )}
                  </p>
                )}
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">
                    {t("worksheet.topic")}
                  </Label>
                  <Select value={topic} onValueChange={setTopic}>
                    <SelectTrigger
                      data-testid="select-worksheet-topic"
                      className="h-11 rounded-xl"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {topics.map((tk) => (
                        <SelectItem key={tk} value={tk}>
                          {t(TOPIC_I18N[tk])}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">
                    {t("worksheet.count")}
                  </Label>
                  <Select
                    value={String(count)}
                    onValueChange={(v) => setCount(Number(v))}
                  >
                    <SelectTrigger
                      data-testid="select-worksheet-count"
                      className="h-11 rounded-xl"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {COUNTS.map((n) => (
                        <SelectItem key={n} value={String(n)}>
                          {n}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}

              <Button
                type="button"
                data-testid="button-worksheet-generate"
                onClick={generate}
                disabled={worksheetMutation.isPending || !selectedStudent}
                className="w-full h-11 rounded-xl font-semibold gap-1.5"
              >
                <Download className="w-4 h-4" />
                {worksheetMutation.isPending
                  ? t("worksheet.generating")
                  : t("worksheet.generate")}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
