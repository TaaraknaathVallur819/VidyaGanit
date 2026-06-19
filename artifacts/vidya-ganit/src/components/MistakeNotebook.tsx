import { motion } from "framer-motion";
import { Loader2, NotebookPen, Check, X, PartyPopper, AlertCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useGetOwnMistakes, getGetOwnMistakesQueryKey } from "@workspace/api-client-react";
import { useLanguage } from "@/lib/i18n";

export default function MistakeNotebook({ vidyaId }: { vidyaId: string }) {
  const { t } = useLanguage();
  const { data, isLoading, isError } = useGetOwnMistakes(vidyaId, {
    query: {
      enabled: !!vidyaId,
      queryKey: getGetOwnMistakesQueryKey(vidyaId),
    },
  });

  const mistakes = data?.mistakes ?? [];

  return (
    <div className="pt-2">
      <h3 className="text-base font-bold text-foreground flex items-center gap-2 mb-1">
        <NotebookPen className="w-5 h-5 text-rose-500" />
        {t("student.notebook.title")}
      </h3>
      <p className="text-xs text-muted-foreground mb-3">{t("student.notebook.subtitle")}</p>

      {isLoading ? (
        <div className="flex items-center justify-center py-10 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin text-primary mr-2" />
          {t("progress.loading")}
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center justify-center py-10 text-center space-y-3 bg-rose-50 rounded-2xl border-2 border-dashed border-rose-200">
          <div className="w-12 h-12 bg-rose-100 rounded-full flex items-center justify-center">
            <AlertCircle className="w-6 h-6 text-rose-500" />
          </div>
          <p className="text-sm font-semibold text-rose-700">{t("strategy.error")}</p>
        </div>
      ) : mistakes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-center space-y-3 bg-emerald-50 rounded-2xl border-2 border-dashed border-emerald-200">
          <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center">
            <PartyPopper className="w-6 h-6 text-emerald-500" />
          </div>
          <p className="text-sm font-semibold text-emerald-700">
            {t("student.notebook.empty")}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {mistakes.map((m, i) => {
            const chosen = m.chosenIndex >= 0 ? m.options[m.chosenIndex] : null;
            return (
              <motion.div
                key={`${m.testId}-${i}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: Math.min(i, 8) * 0.05 }}
              >
                <Card className="border-0 shadow-sm rounded-2xl">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-rose-500 bg-rose-50 px-2 py-0.5 rounded-full">
                        {m.topicLabel}
                      </span>
                    </div>
                    <p className="font-semibold text-sm text-foreground">{m.prompt}</p>
                    <div className="space-y-2">
                      <div className="flex items-start gap-2 text-sm">
                        <X className="w-4 h-4 text-rose-500 mt-0.5 shrink-0" />
                        <span className="text-muted-foreground">
                          {t("student.notebook.yourAnswer")}:{" "}
                          <span className="font-medium text-rose-600">
                            {chosen ?? t("student.notebook.blank")}
                          </span>
                        </span>
                      </div>
                      <div className="flex items-start gap-2 text-sm">
                        <Check className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                        <span className="text-muted-foreground">
                          {t("student.notebook.correctAnswer")}:{" "}
                          <span className="font-medium text-emerald-600">
                            {m.options[m.correctIndex]}
                          </span>
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
