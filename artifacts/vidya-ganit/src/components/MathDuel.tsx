import { useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Swords, Trophy, Hourglass, Clock } from "lucide-react";
import {
  useGetDuels,
  getGetDuelsQueryKey,
  useCreateDuel,
  useGetDuelQuestions,
  getGetDuelQuestionsQueryKey,
  useSubmitDuel,
  type DuelSummary,
} from "@workspace/api-client-react";
import { useLanguage } from "@/lib/i18n";

const LETTERS = ["A", "B", "C", "D", "E", "F"];

export default function MathDuel({ vidyaId }: { vidyaId: string }) {
  const { t } = useLanguage();
  const [playId, setPlayId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<number[]>([]);

  const { data, refetch } = useGetDuels(vidyaId, {
    query: { enabled: !!vidyaId, queryKey: getGetDuelsQueryKey(vidyaId) },
  });
  const create = useCreateDuel();
  const submit = useSubmitDuel();

  const { data: paper } = useGetDuelQuestions(vidyaId, playId ?? "", {
    query: {
      enabled: !!playId,
      queryKey: getGetDuelQuestionsQueryKey(vidyaId, playId ?? ""),
    },
  });

  const challenge = (opponentVidyaId: string) => {
    create.mutate({ vidyaId, data: { opponentVidyaId } }, { onSuccess: () => refetch() });
  };

  const startPlay = (duelId: string, total: number) => {
    setPlayId(duelId);
    setAnswers(new Array(total).fill(-1));
  };

  const sendAnswers = () => {
    if (!playId) return;
    submit.mutate(
      { vidyaId, duelId: playId, data: { answers } },
      {
        onSuccess: () => {
          setPlayId(null);
          setAnswers([]);
          refetch();
        },
      },
    );
  };

  // ── Playing a duel ──
  if (playId && paper) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
        <Card className="border-0 shadow-md rounded-2xl">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Swords className="w-5 h-5 text-primary" />
              <h3 className="font-bold">{t("duel.playTitle")}</h3>
            </div>
            <Button onClick={sendAnswers} disabled={submit.isPending} className="rounded-full" data-testid="button-duel-submit">
              {t("duel.submit")}
            </Button>
          </CardContent>
        </Card>
        {paper.questions.map((q, qi) => (
          <Card key={qi} className="border-0 shadow-sm rounded-2xl">
            <CardContent className="p-5 space-y-3">
              <p className="font-semibold">
                {qi + 1}. {q.prompt}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {q.options.map((opt, oi) => (
                  <button
                    key={oi}
                    type="button"
                    data-testid={`button-duel-q${qi}-opt${oi}`}
                    onClick={() => setAnswers((p) => p.map((a, i) => (i === qi ? oi : a)))}
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

  const opponents = data?.opponents ?? [];
  const incoming = data?.incoming ?? [];
  const outgoing = data?.outgoing ?? [];
  const completed = data?.completed ?? [];

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      <Card className="border-0 shadow-md rounded-2xl">
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Swords className="w-5 h-5 text-primary" />
            <div>
              <h3 className="font-bold text-lg leading-tight">{t("duel.title")}</h3>
              <p className="text-xs text-muted-foreground">{t("duel.subtitle")}</p>
            </div>
          </div>
          {opponents.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">{t("duel.noClassmates")}</p>
          ) : (
            <div className="space-y-2">
              {opponents.map((o) => (
                <div
                  key={o.vidyaId}
                  className="flex items-center justify-between rounded-xl bg-gray-50 border border-gray-100 p-3"
                >
                  <span className="font-medium text-sm">{o.name}</span>
                  <Button
                    size="sm"
                    disabled={create.isPending}
                    onClick={() => challenge(o.vidyaId)}
                    className="rounded-full"
                    data-testid={`button-challenge-${o.vidyaId}`}
                  >
                    {t("duel.challenge")}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {incoming.length > 0 && (
        <Section icon={<Swords className="w-4 h-4 text-rose-500" />} title={t("duel.incoming")}>
          {incoming.map((d) => (
            <DuelRow key={d.duelId} d={d} t={t}>
              <Button
                size="sm"
                onClick={() => startPlay(d.duelId, d.totalQuestions)}
                className="rounded-full"
                data-testid={`button-play-${d.duelId}`}
              >
                {t("duel.play")}
              </Button>
            </DuelRow>
          ))}
        </Section>
      )}

      {outgoing.length > 0 && (
        <Section icon={<Hourglass className="w-4 h-4 text-amber-500" />} title={t("duel.outgoing")}>
          {outgoing.map((d) => (
            <DuelRow key={d.duelId} d={d} t={t}>
              <Badge variant="outline" className="gap-1">
                <Clock className="w-3 h-3" />
                {d.youSubmitted ? t("duel.waitingThem") : t("duel.yourTurn")}
              </Badge>
            </DuelRow>
          ))}
        </Section>
      )}

      <Section icon={<Trophy className="w-4 h-4 text-amber-500" />} title={t("duel.completed")}>
        {completed.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">{t("duel.noCompleted")}</p>
        ) : (
          completed.map((d) => (
            <DuelRow key={d.duelId} d={d} t={t}>
              <Badge
                className={
                  d.winner === "you"
                    ? "bg-emerald-500"
                    : d.winner === "them"
                      ? "bg-red-500"
                      : "bg-gray-400"
                }
              >
                {d.winner === "you"
                  ? t("duel.won")
                  : d.winner === "them"
                    ? t("duel.lost")
                    : t("duel.tie")}{" "}
                {d.yourScore}–{d.theirScore}
              </Badge>
            </DuelRow>
          ))
        )}
      </Section>
    </motion.div>
  );
}

function Section({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="border-0 shadow-sm rounded-2xl">
      <CardContent className="p-5 space-y-2">
        <h4 className="font-bold text-foreground flex items-center gap-2">
          {icon}
          {title}
        </h4>
        {children}
      </CardContent>
    </Card>
  );
}

function DuelRow({
  d,
  t,
  children,
}: {
  d: DuelSummary;
  t: (k: string) => string;
  children: React.ReactNode;
}) {
  const them = d.role === "challenger" ? d.opponentName : d.challengerName;
  return (
    <div className="flex items-center justify-between rounded-xl bg-gray-50 border border-gray-100 p-3 gap-2">
      <div className="min-w-0">
        <p className="font-medium text-sm truncate">
          {t("duel.vs")} {them}
        </p>
        <p className="text-xs text-muted-foreground">
          {d.totalQuestions} {t("duel.questions")}
        </p>
      </div>
      {children}
    </div>
  );
}
