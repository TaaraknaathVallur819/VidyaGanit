import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Timer, Zap, Trophy } from "lucide-react";
import { useSubmitGameScore } from "@workspace/api-client-react";
import { makeQuestion, type GameQuestion } from "@/lib/games";
import { useLanguage } from "@/lib/i18n";

const ROUND_SECONDS = 45;

type Phase = "idle" | "playing" | "result";

export default function SpeedArena({
  vidyaId,
  cls,
  onXpAwarded,
}: {
  vidyaId: string;
  cls: number | null | undefined;
  onXpAwarded?: () => void;
}) {
  const { t } = useLanguage();
  const [phase, setPhase] = useState<Phase>("idle");
  const [question, setQuestion] = useState<GameQuestion | null>(null);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(ROUND_SECONDS);
  const [picked, setPicked] = useState<number | null>(null);
  const [xpAwarded, setXpAwarded] = useState<number | null>(null);

  const submitMutation = useSubmitGameScore();
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const feedbackRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scoreRef = useRef(0);
  const roundRef = useRef(0);
  const clsRef = useRef<number | null | undefined>(cls);
  clsRef.current = cls;

  const clearTimers = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (feedbackRef.current) {
      clearTimeout(feedbackRef.current);
      feedbackRef.current = null;
    }
  }, []);

  const finish = useCallback(() => {
    clearTimers();
    setPhase("result");
    setXpAwarded(null);
    const round = roundRef.current;
    // Reuse the existing race-safe /games/score award path (the "speed" game).
    submitMutation.mutate(
      { data: { vidyaId, game: "speed", score: scoreRef.current } },
      {
        onSuccess: (res) => {
          // Ignore stale responses from a previous round (e.g. quick "Play Again").
          if (roundRef.current !== round) return;
          setXpAwarded(res.xpAwarded);
          if (res.xpAwarded > 0) onXpAwarded?.();
        },
      },
    );
  }, [clearTimers, vidyaId, submitMutation, onXpAwarded]);

  const start = useCallback(() => {
    clearTimers();
    roundRef.current += 1;
    scoreRef.current = 0;
    setScore(0);
    setPicked(null);
    setTimeLeft(ROUND_SECONDS);
    setQuestion(makeQuestion("speed", clsRef.current));
    setPhase("playing");
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          finish();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [clearTimers, finish]);

  const answer = (i: number) => {
    if (picked !== null || !question) return;
    setPicked(i);
    if (i === question.answer) {
      scoreRef.current += 1;
      setScore(scoreRef.current);
    }
    feedbackRef.current = setTimeout(() => {
      setPicked(null);
      setQuestion(makeQuestion("speed", clsRef.current));
    }, 250);
  };

  useEffect(() => () => clearTimers(), [clearTimers]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
    >
      <Card className="border-0 shadow-md rounded-2xl overflow-hidden">
        <CardContent className="p-6 space-y-5">
          <div className="flex items-center gap-2">
            <Timer className="w-5 h-5 text-rose-500" />
            <div>
              <h3 className="font-bold text-lg text-foreground leading-tight">
                {t("arena.title")}
              </h3>
              <p className="text-xs text-muted-foreground">
                {t("arena.subtitle")}
              </p>
            </div>
            {phase === "playing" && (
              <div className="ml-auto flex items-center gap-2">
                <Badge variant="secondary" className="font-bold gap-1">
                  <Zap className="w-3.5 h-3.5" />
                  {t("arena.score").replace("{score}", String(score))}
                </Badge>
                <Badge
                  variant={timeLeft <= 10 ? "destructive" : "outline"}
                  className="font-bold tabular-nums"
                  data-testid="text-arena-time"
                >
                  {t("arena.timeLeft").replace("{sec}", String(timeLeft))}
                </Badge>
              </div>
            )}
          </div>

          {phase === "idle" && (
            <div className="text-center py-8 space-y-4">
              <div className="text-5xl">⚡</div>
              <Button
                type="button"
                data-testid="button-arena-start"
                onClick={start}
                className="h-11 px-8 rounded-xl font-semibold"
              >
                {t("arena.start")}
              </Button>
            </div>
          )}

          {phase === "playing" && question && (
            <div className="space-y-4">
              <div className="rounded-2xl bg-rose-50 border border-rose-100 p-6 text-center">
                <p
                  className="text-3xl font-extrabold text-foreground tracking-wide"
                  data-testid="text-arena-question"
                >
                  {question.prompt}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                {question.options.map((opt, i) => {
                  const isPicked = picked === i;
                  const isAnswer = i === question.answer;
                  const cls2 =
                    picked === null
                      ? "border-muted text-foreground hover:border-primary/40"
                      : isAnswer
                        ? "border-emerald-400 bg-emerald-50 text-emerald-700"
                        : isPicked
                          ? "border-red-300 bg-red-50 text-red-600"
                          : "border-muted text-muted-foreground opacity-60";
                  return (
                    <button
                      key={`${opt}-${i}`}
                      type="button"
                      data-testid={`button-arena-option-${i}`}
                      onClick={() => answer(i)}
                      disabled={picked !== null}
                      className={`h-14 rounded-xl border-2 text-xl font-bold transition-all ${cls2}`}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {phase === "result" && (
            <div className="text-center py-6 space-y-4">
              <Trophy className="w-12 h-12 text-amber-400 mx-auto" />
              <p
                className="text-2xl font-extrabold text-foreground"
                data-testid="text-arena-final"
              >
                {t("arena.finalScore").replace("{score}", String(score))}
              </p>
              {xpAwarded === null ? (
                <p className="text-sm text-muted-foreground">
                  {t("arena.getReady")}
                </p>
              ) : xpAwarded > 0 ? (
                <Badge variant="secondary" className="text-base font-bold px-3 py-1">
                  {t("arena.xpAwarded").replace("{xp}", String(xpAwarded))}
                </Badge>
              ) : (
                <p className="text-sm text-muted-foreground">{t("arena.noXp")}</p>
              )}
              <div>
                <Button
                  type="button"
                  data-testid="button-arena-again"
                  onClick={start}
                  className="h-11 px-8 rounded-xl font-semibold"
                >
                  {t("arena.playAgain")}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
