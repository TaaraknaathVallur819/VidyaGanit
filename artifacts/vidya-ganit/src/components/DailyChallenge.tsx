import { useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, CheckCircle2, XCircle } from "lucide-react";
import {
  useGetDailyChallenge,
  getGetDailyChallengeQueryKey,
  useSubmitDailyChallenge,
} from "@workspace/api-client-react";
import { useLanguage } from "@/lib/i18n";

export default function DailyChallenge({
  vidyaId,
  onXpAwarded,
}: {
  vidyaId: string;
  onXpAwarded?: () => void;
}) {
  const { t } = useLanguage();
  const [selected, setSelected] = useState<number | null>(null);

  const { data, isLoading, refetch } = useGetDailyChallenge(vidyaId, {
    query: { enabled: !!vidyaId, queryKey: getGetDailyChallengeQueryKey(vidyaId) },
  });
  const submitMutation = useSubmitDailyChallenge();

  const completed = data?.completed ?? false;

  const handleSubmit = () => {
    if (selected === null || !vidyaId) return;
    submitMutation.mutate(
      { vidyaId, data: { answer: selected } },
      {
        onSuccess: () => {
          refetch();
          onXpAwarded?.();
        },
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
            <CalendarDays className="w-5 h-5 text-sky-500" />
            <div>
              <h3 className="font-bold text-lg text-foreground leading-tight">
                {t("dailyChallenge.title")}
              </h3>
              <p className="text-xs text-muted-foreground">
                {t("dailyChallenge.subtitle")}
              </p>
            </div>
          </div>

          {isLoading ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              {t("dailyChallenge.loading")}
            </p>
          ) : !data ? null : (
            <>
              <div className="rounded-2xl bg-sky-50 border border-sky-100 p-4">
                <p className="text-base font-semibold text-foreground">
                  {data.question}
                </p>
              </div>

              {completed ? (
                <div className="space-y-3">
                  <div
                    data-testid="text-daily-result"
                    className={`flex items-center gap-2 rounded-xl p-3 text-sm font-semibold ${
                      data.correct
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        : "bg-red-50 text-red-700 border border-red-200"
                    }`}
                  >
                    {data.correct ? (
                      <CheckCircle2 className="w-5 h-5" />
                    ) : (
                      <XCircle className="w-5 h-5" />
                    )}
                    {data.correct
                      ? t("dailyChallenge.correct")
                      : t("dailyChallenge.incorrect")}
                    {data.correct && data.xpAwarded > 0 && (
                      <Badge variant="secondary" className="ml-auto font-bold">
                        {t("dailyChallenge.xpAwarded").replace(
                          "{xp}",
                          String(data.xpAwarded),
                        )}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground text-center">
                    {t("dailyChallenge.comeBack")}
                  </p>
                </div>
              ) : (
                <>
                  <p className="text-xs text-muted-foreground -mt-2">
                    {t("dailyChallenge.pickAnswer")}
                  </p>
                  <div className="grid grid-cols-2 gap-2.5">
                    {data.options.map((opt, i) => (
                      <button
                        key={`${opt}-${i}`}
                        type="button"
                        data-testid={`button-daily-option-${i}`}
                        onClick={() => setSelected(opt)}
                        className={`h-12 rounded-xl border-2 text-base font-bold transition-all ${
                          selected === opt
                            ? "border-primary bg-primary/5 text-primary"
                            : "border-muted text-foreground hover:border-primary/30"
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                  <Button
                    type="button"
                    data-testid="button-daily-submit"
                    disabled={selected === null || submitMutation.isPending}
                    onClick={handleSubmit}
                    className="w-full h-11 rounded-xl font-semibold"
                  >
                    {submitMutation.isPending
                      ? t("dailyChallenge.submitting")
                      : t("dailyChallenge.cta")}
                  </Button>
                </>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
