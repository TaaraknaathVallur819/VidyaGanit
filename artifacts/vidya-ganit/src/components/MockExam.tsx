import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ClipboardCheck, Clock, Trophy, CheckCircle2, XCircle } from "lucide-react";
import {
  useStartMockExam,
  useSubmitMockExam,
  useGetMockExamHistory,
  getGetMockExamHistoryQueryKey,
  type MockExamPaper,
  type MockExamResult,
} from "@workspace/api-client-react";
import { useLanguage } from "@/lib/i18n";

const LETTERS = ["A", "B", "C", "D", "E", "F"];

function fmt(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function MockExam({ vidyaId }: { vidyaId: string }) {
  const { t } = useLanguage();
  const [count, setCount] = useState("10");
  const [paper, setPaper] = useState<MockExamPaper | null>(null);
  const [answers, setAnswers] = useState<number[]>([]);
  const [remaining, setRemaining] = useState(0);
  const [result, setResult] = useState<MockExamResult | null>(null);
  const startedAt = useRef(0);

  const start = useStartMockExam();
  const submitMut = useSubmitMockExam();
  const { data: history, refetch } = useGetMockExamHistory(vidyaId, {
    query: { enabled: !!vidyaId, queryKey: getGetMockExamHistoryQueryKey(vidyaId) },
  });

  const finishExam = () => {
    if (!paper || submitMut.isPending) return;
    const timeTakenSec = Math.round((Date.now() - startedAt.current) / 1000);
    submitMut.mutate(
      { vidyaId, data: { examId: paper.examId, answers, timeTakenSec } },
      {
        onSuccess: (res) => {
          setResult(res);
          setPaper(null);
          refetch();
        },
      },
    );
  };

  // Countdown timer for the active paper.
  useEffect(() => {
    if (!paper) return;
    if (remaining <= 0) {
      finishExam();
      return;
    }
    const id = setTimeout(() => setRemaining((r) => r - 1), 1000);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paper, remaining]);

  const beginExam = () => {
    setResult(null);
    start.mutate(
      { vidyaId, data: { questionCount: Number(count) } },
      {
        onSuccess: (p) => {
          setPaper(p);
          setAnswers(new Array(p.questions.length).fill(-1));
          setRemaining(p.durationSec);
          startedAt.current = Date.now();
        },
      },
    );
  };

  // ── Active paper ──
  if (paper) {
    const answered = answers.filter((a) => a >= 0).length;
    const low = remaining <= 30;
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
        <Card className="border-0 shadow-md rounded-2xl sticky top-2 z-10">
          <CardContent className="p-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Clock className={`w-5 h-5 ${low ? "text-red-500" : "text-primary"}`} />
              <span
                className={`font-bold tabular-nums text-lg ${low ? "text-red-500" : "text-foreground"}`}
                data-testid="text-exam-timer"
              >
                {fmt(remaining)}
              </span>
            </div>
            <span className="text-sm text-muted-foreground">
              {answered} / {paper.questions.length}
            </span>
            <Button
              onClick={finishExam}
              disabled={submitMut.isPending}
              className="rounded-full"
              data-testid="button-submit-exam"
            >
              {t("mock.submit")}
            </Button>
          </CardContent>
        </Card>

        {paper.questions.map((q, qi) => (
          <Card key={qi} className="border-0 shadow-sm rounded-2xl">
            <CardContent className="p-5 space-y-3">
              <p className="font-semibold text-foreground">
                {qi + 1}. {q.prompt}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {q.options.map((opt, oi) => (
                  <button
                    key={oi}
                    type="button"
                    data-testid={`button-exam-q${qi}-opt${oi}`}
                    onClick={() =>
                      setAnswers((prev) => prev.map((a, i) => (i === qi ? oi : a)))
                    }
                    className={`text-left rounded-xl border p-3 text-sm transition ${
                      answers[qi] === oi
                        ? "border-primary bg-primary/10 font-semibold"
                        : "border-gray-200 hover:border-primary/40"
                    }`}
                  >
                    <span className="font-bold mr-2">{LETTERS[oi]}</span>
                    {opt}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </motion.div>
    );
  }

  // ── Result analysis ──
  if (result) {
    const pct = Math.round((result.correctCount / result.totalQuestions) * 100);
    return (
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
        <Card className="border-0 shadow-md rounded-2xl overflow-hidden">
          <CardContent className="p-6 text-center space-y-2">
            <Trophy className="w-10 h-10 text-amber-500 mx-auto" />
            <h3 className="text-xl font-bold">{t("mock.resultTitle")}</h3>
            <p className="text-4xl font-extrabold text-primary tabular-nums">{pct}%</p>
            <p className="text-sm text-muted-foreground">
              {result.correctCount} / {result.totalQuestions} · +{result.xpAwarded} XP
              {result.timeTakenSec != null ? ` · ${fmt(result.timeTakenSec)}` : ""}
            </p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm rounded-2xl">
          <CardContent className="p-5 space-y-3">
            <h4 className="font-bold text-foreground">{t("mock.byTopic")}</h4>
            {result.topicBreakdown.map((b) => {
              const tp = Math.round((b.correct / b.total) * 100);
              return (
                <div key={b.topic} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">{b.label}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {b.correct} / {b.total}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                    <div
                      className={`h-full ${tp >= 60 ? "bg-emerald-500" : "bg-amber-500"}`}
                      style={{ width: `${tp}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm rounded-2xl">
          <CardContent className="p-5 space-y-3">
            <h4 className="font-bold text-foreground">{t("mock.review")}</h4>
            {result.review.map((r, i) => {
              const ok = r.chosenIndex === r.answerIndex;
              return (
                <div key={i} className="rounded-xl bg-gray-50 border border-gray-100 p-3 text-sm">
                  <div className="flex items-start gap-2">
                    {ok ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                    )}
                    <div className="min-w-0">
                      <p className="font-medium text-foreground">{r.prompt}</p>
                      {!ok && (
                        <p className="text-xs text-emerald-700 mt-1">
                          {t("mock.correctAnswer")}: {LETTERS[r.answerIndex]}.{" "}
                          {r.options[r.answerIndex]}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Button onClick={() => setResult(null)} variant="outline" className="rounded-full w-full" data-testid="button-exam-done">
          {t("mock.done")}
        </Button>
      </motion.div>
    );
  }

  // ── Idle / start screen ──
  const exams = history?.exams ?? [];
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      <Card className="border-0 shadow-md rounded-2xl overflow-hidden">
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5 text-primary" />
            <div>
              <h3 className="font-bold text-lg leading-tight">{t("mock.title")}</h3>
              <p className="text-xs text-muted-foreground">{t("mock.subtitle")}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm font-medium">{t("mock.questions")}</span>
            <Select value={count} onValueChange={setCount}>
              <SelectTrigger className="w-28 h-9 rounded-xl" data-testid="select-exam-count">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="15">15</SelectItem>
                <SelectItem value="20">20</SelectItem>
                <SelectItem value="30">30</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={beginExam} disabled={start.isPending} className="rounded-full" data-testid="button-start-exam">
              {start.isPending ? t("mock.starting") : t("mock.start")}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm rounded-2xl">
        <CardContent className="p-5 space-y-3">
          <h4 className="font-bold text-foreground">{t("mock.history")}</h4>
          {exams.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">{t("mock.noHistory")}</p>
          ) : (
            exams.map((e) => {
              const pct = Math.round((e.correctCount / e.totalQuestions) * 100);
              return (
                <div
                  key={e.examId}
                  className="flex items-center justify-between rounded-xl bg-gray-50 border border-gray-100 p-3"
                  data-testid={`card-exam-${e.examId}`}
                >
                  <div>
                    <p className="font-semibold text-sm">
                      {e.correctCount} / {e.totalQuestions}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(e.completedAt).toLocaleDateString("en-IN")}
                    </p>
                  </div>
                  <Badge variant="outline" className="tabular-nums">
                    {pct}%
                  </Badge>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
