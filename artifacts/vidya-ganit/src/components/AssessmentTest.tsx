import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  ClipboardCheck,
  Check,
  X,
  Trophy,
  Sparkles,
  ArrowRight,
  PartyPopper,
} from "lucide-react";
import {
  useGenerateAssessment,
  useSubmitAssessment,
  getListOwnAssessmentsQueryKey,
} from "@workspace/api-client-react";
import type {
  GeneratedAssessment,
  AssessmentResult,
  GenerateAssessmentInputLanguage,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useLanguage } from "@/lib/i18n";

type Phase = "loading" | "taking" | "result" | "error";

/**
 * A celebratory, kid-friendly graded test. Pulls a freshly generated set of
 * MCQ questions for a topic, lets the student answer at their own pace, then
 * scores them with points-per-correct and NO negative marking. The answer key
 * never reaches the client until after submission (returned in the review).
 */
export default function AssessmentTest({
  open,
  onClose,
  topic,
  vidyaId,
  onCompleted,
}: {
  open: boolean;
  onClose: () => void;
  topic: string | null;
  vidyaId: string;
  onCompleted?: () => void;
}) {
  const { t, lang } = useLanguage();
  const queryClient = useQueryClient();

  const [phase, setPhase] = useState<Phase>("loading");
  const [test, setTest] = useState<GeneratedAssessment | null>(null);
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [result, setResult] = useState<AssessmentResult | null>(null);

  const generate = useGenerateAssessment();
  const submit = useSubmitAssessment();

  // Generate a fresh test whenever the dialog opens for a topic.
  useEffect(() => {
    if (!open || !topic) return;
    let cancelled = false;

    setPhase("loading");
    setTest(null);
    setResult(null);
    setCurrent(0);
    setAnswers([]);

    generate.mutate(
      {
        data: {
          topic,
          language: lang as GenerateAssessmentInputLanguage,
        },
      },
      {
        onSuccess: (data) => {
          if (cancelled) return;
          setTest(data);
          setAnswers(new Array(data.questions.length).fill(-1));
          setPhase("taking");
        },
        onError: () => {
          if (!cancelled) setPhase("error");
        },
      },
    );

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, topic]);

  const choose = (optionIndex: number) => {
    setAnswers((prev) => {
      const next = [...prev];
      next[current] = optionIndex;
      return next;
    });
  };

  const goNext = () => {
    if (!test) return;
    if (current < test.questions.length - 1) {
      setCurrent((c) => c + 1);
    }
  };

  const handleSubmit = () => {
    if (!test) return;
    submit.mutate(
      { data: { testId: test.testId, answers } },
      {
        onSuccess: (data) => {
          setResult(data);
          setPhase("result");
          void queryClient.invalidateQueries({
            queryKey: getListOwnAssessmentsQueryKey(vidyaId),
          });
          onCompleted?.();
        },
        onError: () => setPhase("error"),
      },
    );
  };

  const answeredCount = answers.filter((a) => a >= 0).length;
  const allAnswered = test ? answeredCount === test.questions.length : false;

  const handleOpenChange = (next: boolean) => {
    if (!next) onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md rounded-3xl border-0 p-0 overflow-hidden gap-0">
        {/* Header banner */}
        <div className="bg-gradient-to-br from-indigo-500 via-violet-500 to-purple-600 px-6 py-5 text-white">
          <DialogHeader className="space-y-1">
            <DialogTitle className="flex items-center gap-2 text-lg font-extrabold text-white">
              <ClipboardCheck className="w-5 h-5" />
              {t("test.title")}
            </DialogTitle>
            {test && (
              <p className="text-sm text-white/85 font-medium">
                {test.topicLabel}
              </p>
            )}
          </DialogHeader>
        </div>

        <div className="p-6">
          {phase === "loading" && (
            <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-sm font-medium text-muted-foreground">
                {t("test.preparing")}
              </p>
            </div>
          )}

          {phase === "error" && (
            <div className="flex flex-col items-center justify-center py-10 text-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-rose-50 flex items-center justify-center">
                <X className="w-7 h-7 text-rose-500" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">
                {t("test.error")}
              </p>
              <Button onClick={onClose} variant="outline" className="rounded-xl">
                {t("test.close")}
              </Button>
            </div>
          )}

          {phase === "taking" && test && (
            <div>
              {/* Progress */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-1.5 text-xs font-semibold text-muted-foreground">
                  <span>
                    {t("test.question")
                      .replace("{n}", String(current + 1))
                      .replace("{total}", String(test.questions.length))}
                  </span>
                  <span className="flex items-center gap-1 text-amber-600">
                    <Sparkles className="w-3.5 h-3.5" />
                    {t("test.pointsEach").replace(
                      "{pts}",
                      String(test.pointsPerCorrect),
                    )}
                  </span>
                </div>
                <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-600"
                    initial={false}
                    animate={{
                      width: `${((current + 1) / test.questions.length) * 100}%`,
                    }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
              </div>

              <AnimatePresence mode="wait">
                <motion.div
                  key={current}
                  initial={{ opacity: 0, x: 24 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -24 }}
                  transition={{ duration: 0.22 }}
                >
                  <p className="text-base font-bold text-foreground mb-4 min-h-[3rem]">
                    {test.questions[current].prompt}
                  </p>
                  <div className="space-y-2.5">
                    {test.questions[current].options.map((opt, i) => {
                      const selected = answers[current] === i;
                      return (
                        <button
                          key={i}
                          type="button"
                          onClick={() => choose(i)}
                          className={`w-full text-left flex items-center gap-3 rounded-2xl border-2 px-4 py-3 text-sm font-semibold transition-all ${
                            selected
                              ? "border-primary bg-indigo-50 text-primary shadow-sm"
                              : "border-gray-200 bg-white text-foreground hover:border-indigo-300 hover:bg-indigo-50/40"
                          }`}
                        >
                          <span
                            className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 ${
                              selected
                                ? "bg-primary text-white"
                                : "bg-gray-100 text-muted-foreground"
                            }`}
                          >
                            {String.fromCharCode(65 + i)}
                          </span>
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                </motion.div>
              </AnimatePresence>

              {/* Footer actions */}
              <div className="mt-6 flex items-center gap-2">
                {current < test.questions.length - 1 ? (
                  <Button
                    onClick={goNext}
                    disabled={answers[current] < 0}
                    className="flex-1 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 font-bold"
                  >
                    {t("test.next")}
                    <ArrowRight className="w-4 h-4 ml-1" />
                  </Button>
                ) : (
                  <Button
                    onClick={handleSubmit}
                    disabled={!allAnswered || submit.isPending}
                    className="flex-1 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 font-bold"
                  >
                    {submit.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Trophy className="w-4 h-4 mr-1" />
                        {t("test.submit")}
                      </>
                    )}
                  </Button>
                )}
              </div>
              {current === test.questions.length - 1 && !allAnswered && (
                <p className="mt-2 text-center text-[11px] font-medium text-muted-foreground">
                  {t("test.answerAll")}
                </p>
              )}
            </div>
          )}

          {phase === "result" && result && (
            <ResultView result={result} onClose={onClose} t={t} />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ResultView({
  result,
  onClose,
  t,
}: {
  result: AssessmentResult;
  onClose: () => void;
  t: (key: string) => string;
}) {
  const pct =
    result.maxScore > 0 ? Math.round((result.score / result.maxScore) * 100) : 0;
  const cheer =
    pct >= 80
      ? t("test.cheer.great")
      : pct >= 50
        ? t("test.cheer.good")
        : t("test.cheer.keepGoing");

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className="text-center"
    >
      <motion.div
        initial={{ scale: 0, rotate: -20 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 220, damping: 14 }}
        className="mx-auto w-20 h-20 rounded-3xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg mb-3"
      >
        <PartyPopper className="w-10 h-10 text-white" />
      </motion.div>

      <p className="text-sm font-semibold text-muted-foreground">{cheer}</p>
      <p className="mt-1 text-4xl font-extrabold text-foreground">
        {result.score}
        <span className="text-lg font-bold text-muted-foreground">
          {" "}
          / {result.maxScore}
        </span>
      </p>
      <p className="text-xs font-medium text-muted-foreground mt-1">
        {t("test.pointsLabel")}
      </p>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-green-50 border border-green-100 px-4 py-3">
          <p className="text-2xl font-extrabold text-green-600 leading-none">
            {result.correctCount}
          </p>
          <p className="text-xs font-medium text-green-700 mt-1 flex items-center justify-center gap-1">
            <Check className="w-3.5 h-3.5" />
            {t("test.correct")}
          </p>
        </div>
        <div className="rounded-2xl bg-rose-50 border border-rose-100 px-4 py-3">
          <p className="text-2xl font-extrabold text-rose-500 leading-none">
            {result.incorrectCount}
          </p>
          <p className="text-xs font-medium text-rose-600 mt-1 flex items-center justify-center gap-1">
            <X className="w-3.5 h-3.5" />
            {t("test.incorrect")}
          </p>
        </div>
      </div>

      <p className="mt-3 text-[11px] font-medium text-muted-foreground">
        {t("test.noNegative")}
      </p>

      {/* Per-question review */}
      <div className="mt-5 space-y-2 text-left max-h-52 overflow-y-auto pr-1">
        {result.review.map((q, i) => (
          <div
            key={i}
            className={`rounded-2xl border px-3 py-2.5 ${
              q.correct
                ? "border-green-100 bg-green-50/60"
                : "border-rose-100 bg-rose-50/60"
            }`}
          >
            <div className="flex items-start gap-2">
              <span
                className={`mt-0.5 w-5 h-5 rounded-lg flex items-center justify-center shrink-0 ${
                  q.correct ? "bg-green-500" : "bg-rose-500"
                }`}
              >
                {q.correct ? (
                  <Check className="w-3 h-3 text-white" />
                ) : (
                  <X className="w-3 h-3 text-white" />
                )}
              </span>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-foreground">
                  {q.prompt}
                </p>
                {!q.correct && (
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {t("test.correctAnswer")}:{" "}
                    <span className="font-semibold text-green-700">
                      {q.options[q.answerIndex]}
                    </span>
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <Button
        onClick={onClose}
        className="mt-6 w-full rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 font-bold"
      >
        {t("test.done")}
      </Button>
    </motion.div>
  );
}
