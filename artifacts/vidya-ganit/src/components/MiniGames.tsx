import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Zap, Timer, Trophy, Gamepad2, Check, X } from "lucide-react";
import { useSubmitGameScore } from "@workspace/api-client-react";
import { useLanguage } from "@/lib/i18n";

type GameId = "speed" | "truefalse" | "missing";

type Question = {
  prompt: string;
  options: string[];
  answer: number; // index into options
};

const ROUND_SECONDS = 30;

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildChoices(correct: number): Question["options"] {
  const set = new Set<number>([correct]);
  while (set.size < 4) {
    const delta = randInt(-9, 9);
    const candidate = correct + delta;
    if (candidate >= 0 && delta !== 0) set.add(candidate);
  }
  const opts = shuffle([...set]);
  return opts.map(String);
}

function makeSpeed(): Question {
  const ops = ["+", "−", "×"] as const;
  const op = ops[randInt(0, 2)];
  let a: number;
  let b: number;
  let answer: number;
  if (op === "+") {
    a = randInt(2, 49);
    b = randInt(2, 49);
    answer = a + b;
  } else if (op === "−") {
    a = randInt(10, 60);
    b = randInt(1, a);
    answer = a - b;
  } else {
    a = randInt(2, 12);
    b = randInt(2, 12);
    answer = a * b;
  }
  const opts = buildChoices(answer);
  return {
    prompt: `${a} ${op} ${b} = ?`,
    options: opts,
    answer: opts.indexOf(String(answer)),
  };
}

function makeMissing(): Question {
  const ops = ["+", "−", "×"] as const;
  const op = ops[randInt(0, 2)];
  let a: number;
  let result: number;
  let missing: number;
  if (op === "+") {
    a = randInt(2, 30);
    missing = randInt(2, 30);
    result = a + missing;
  } else if (op === "−") {
    missing = randInt(2, 30);
    a = randInt(missing, 60);
    result = a - missing;
  } else {
    a = randInt(2, 10);
    missing = randInt(2, 10);
    result = a * missing;
  }
  const opts = buildChoices(missing);
  return {
    prompt: `${a} ${op} ? = ${result}`,
    options: opts,
    answer: opts.indexOf(String(missing)),
  };
}

function makeTrueFalse(): Question {
  const ops = ["+", "−", "×"] as const;
  const op = ops[randInt(0, 2)];
  let a: number;
  let b: number;
  let real: number;
  if (op === "+") {
    a = randInt(2, 49);
    b = randInt(2, 49);
    real = a + b;
  } else if (op === "−") {
    a = randInt(10, 60);
    b = randInt(1, a);
    real = a - b;
  } else {
    a = randInt(2, 12);
    b = randInt(2, 12);
    real = a * b;
  }
  const isTrue = Math.random() < 0.5;
  let shown = real;
  if (!isTrue) {
    // Pick a wrong value that stays >= 0 and never equals the real answer.
    do {
      const delta = (Math.random() < 0.5 ? 1 : -1) * randInt(1, 5);
      shown = Math.max(0, real + delta);
    } while (shown === real);
  }
  // options: index 0 = "true" (✓), index 1 = "false" (✗)
  return {
    prompt: `${a} ${op} ${b} = ${shown}`,
    options: ["true", "false"],
    answer: isTrue ? 0 : 1,
  };
}

function makeQuestion(game: GameId): Question {
  if (game === "speed") return makeSpeed();
  if (game === "missing") return makeMissing();
  return makeTrueFalse();
}

const GAMES: { id: GameId; emoji: string; nameKey: string; descKey: string }[] = [
  { id: "speed", emoji: "⚡", nameKey: "games.speed.name", descKey: "games.speed.desc" },
  {
    id: "truefalse",
    emoji: "🤔",
    nameKey: "games.truefalse.name",
    descKey: "games.truefalse.desc",
  },
  {
    id: "missing",
    emoji: "🔢",
    nameKey: "games.missing.name",
    descKey: "games.missing.desc",
  },
];

export default function MiniGames({
  open,
  onClose,
  vidyaId,
  onXpAwarded,
}: {
  open: boolean;
  onClose: () => void;
  vidyaId: string;
  onXpAwarded?: () => void;
}) {
  const { t } = useLanguage();
  const [phase, setPhase] = useState<"menu" | "playing" | "result">("menu");
  const [game, setGame] = useState<GameId>("speed");
  const [question, setQuestion] = useState<Question | null>(null);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(ROUND_SECONDS);
  const [picked, setPicked] = useState<number | null>(null);
  const [xpAwarded, setXpAwarded] = useState<number | null>(null);

  const submitMutation = useSubmitGameScore();
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const feedbackRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scoreRef = useRef(0);
  // The active game is tracked in a ref so the interval/finish callbacks never
  // read a stale `game` value captured at the time the closure was created.
  const gameRef = useRef<GameId>("speed");

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (feedbackRef.current) {
      clearTimeout(feedbackRef.current);
      feedbackRef.current = null;
    }
  }, []);

  const finishGame = useCallback(() => {
    clearTimer();
    setPhase("result");
    setXpAwarded(null);
    const finalScore = scoreRef.current;
    submitMutation.mutate(
      { data: { vidyaId, game: gameRef.current, score: finalScore } },
      {
        onSuccess: (res) => {
          setXpAwarded(res.xpAwarded);
          if (res.xpAwarded > 0) onXpAwarded?.();
        },
      },
    );
  }, [clearTimer, vidyaId, submitMutation, onXpAwarded]);

  const startGame = useCallback(
    (id: GameId) => {
      clearTimer();
      gameRef.current = id;
      setGame(id);
      setScore(0);
      scoreRef.current = 0;
      setPicked(null);
      setTimeLeft(ROUND_SECONDS);
      setQuestion(makeQuestion(id));
      setPhase("playing");
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            finishGame();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    },
    [clearTimer, finishGame],
  );

  const handleAnswer = (index: number) => {
    if (picked !== null || !question) return;
    setPicked(index);
    const correct = index === question.answer;
    if (correct) {
      scoreRef.current += 1;
      setScore(scoreRef.current);
    }
    // Brief feedback flash, then next question.
    feedbackRef.current = setTimeout(() => {
      setPicked(null);
      setQuestion(makeQuestion(gameRef.current));
    }, 350);
  };

  // Reset to menu whenever the dialog is opened fresh.
  useEffect(() => {
    if (open) {
      setPhase("menu");
      setScore(0);
      scoreRef.current = 0;
    } else {
      clearTimer();
    }
  }, [open, clearTimer]);

  useEffect(() => () => clearTimer(), [clearTimer]);

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      clearTimer();
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md rounded-2xl overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gamepad2 className="w-5 h-5 text-primary" /> {t("games.title")}
          </DialogTitle>
        </DialogHeader>

        {/* ── Menu ── */}
        {phase === "menu" && (
          <div className="space-y-3 mt-1">
            <p className="text-sm text-muted-foreground">{t("games.subtitle")}</p>
            <div className="space-y-2.5">
              {GAMES.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  data-testid={`button-game-${g.id}`}
                  onClick={() => startGame(g.id)}
                  className="w-full flex items-center gap-3 rounded-2xl border-2 border-indigo-100 bg-white px-4 py-3 text-left hover:border-primary hover:bg-indigo-50 transition-all"
                >
                  <span className="text-2xl shrink-0">{g.emoji}</span>
                  <span className="min-w-0">
                    <span className="block font-bold text-sm text-foreground">
                      {t(g.nameKey)}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {t(g.descKey)}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Playing ── */}
        {phase === "playing" && question && (
          <div className="mt-1">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-1.5 text-sm font-bold text-amber-600">
                <Trophy className="w-4 h-4" />
                {t("games.score")}: {score}
              </div>
              <div
                className={`flex items-center gap-1.5 text-sm font-bold ${
                  timeLeft <= 5 ? "text-red-500" : "text-primary"
                }`}
              >
                <Timer className="w-4 h-4" />
                {timeLeft}s
              </div>
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={question.prompt}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.18 }}
                className="text-center mb-5"
              >
                <p className="text-4xl font-extrabold tracking-tight text-foreground py-4 select-none">
                  {question.prompt}
                </p>
              </motion.div>
            </AnimatePresence>

            {game === "truefalse" ? (
              <div className="grid grid-cols-2 gap-3">
                {[0, 1].map((idx) => {
                  const isCorrectChoice = picked !== null && idx === question.answer;
                  const isWrongPick =
                    picked === idx && idx !== question.answer;
                  return (
                    <button
                      key={idx}
                      type="button"
                      data-testid={`answer-tf-${idx}`}
                      onClick={() => handleAnswer(idx)}
                      disabled={picked !== null}
                      className={`h-16 rounded-2xl border-2 flex items-center justify-center text-2xl font-bold transition-all ${
                        isCorrectChoice
                          ? "border-green-400 bg-green-50 text-green-600"
                          : isWrongPick
                            ? "border-red-400 bg-red-50 text-red-500"
                            : "border-indigo-100 bg-white hover:border-primary hover:bg-indigo-50"
                      }`}
                    >
                      {idx === 0 ? (
                        <Check className="w-7 h-7" />
                      ) : (
                        <X className="w-7 h-7" />
                      )}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {question.options.map((opt, idx) => {
                  const isCorrectChoice = picked !== null && idx === question.answer;
                  const isWrongPick = picked === idx && idx !== question.answer;
                  return (
                    <button
                      key={`${opt}-${idx}`}
                      type="button"
                      data-testid={`answer-opt-${idx}`}
                      onClick={() => handleAnswer(idx)}
                      disabled={picked !== null}
                      className={`h-14 rounded-2xl border-2 flex items-center justify-center text-xl font-bold transition-all ${
                        isCorrectChoice
                          ? "border-green-400 bg-green-50 text-green-600"
                          : isWrongPick
                            ? "border-red-400 bg-red-50 text-red-500"
                            : "border-indigo-100 bg-white text-foreground hover:border-primary hover:bg-indigo-50"
                      }`}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Result ── */}
        {phase === "result" && (
          <div className="text-center py-4 space-y-4">
            <motion.div
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 260, damping: 18 }}
              className="text-6xl"
            >
              🎉
            </motion.div>
            <p className="text-lg font-bold text-foreground">
              {t("games.result").replace("{score}", String(score))}
            </p>
            {xpAwarded !== null && xpAwarded > 0 && (
              <div className="inline-flex items-center gap-1.5 bg-amber-500 text-white text-sm font-bold px-3 py-1.5 rounded-full shadow">
                <Zap className="w-4 h-4" />
                {t("games.xpEarned").replace("{xp}", String(xpAwarded))}
              </div>
            )}
            <div className="flex gap-2.5 pt-1">
              <Button
                type="button"
                data-testid="button-play-again"
                onClick={() => startGame(game)}
                className="flex-1 h-11 rounded-xl font-semibold"
              >
                {t("games.playAgain")}
              </Button>
              <Button
                type="button"
                variant="outline"
                data-testid="button-games-menu"
                onClick={() => setPhase("menu")}
                className="flex-1 h-11 rounded-xl font-semibold"
              >
                {t("games.pick")}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
