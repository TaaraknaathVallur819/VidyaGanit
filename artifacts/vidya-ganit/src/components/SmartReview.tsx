import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Brain, Eye } from "lucide-react";
import {
  useGetReviewDue,
  getGetReviewDueQueryKey,
  useGradeReviewItem,
} from "@workspace/api-client-react";
import { useLanguage } from "@/lib/i18n";

export default function SmartReview({
  vidyaId,
  onXpAwarded,
}: {
  vidyaId: string;
  onXpAwarded?: () => void;
}) {
  const { t } = useLanguage();
  const [revealed, setRevealed] = useState(false);

  const { data, isLoading, refetch } = useGetReviewDue(vidyaId, {
    query: { enabled: !!vidyaId, queryKey: getGetReviewDueQueryKey(vidyaId) },
  });
  const gradeMutation = useGradeReviewItem();

  const items = data?.items ?? [];
  const current = items[0];

  const grade = (quality: number) => {
    if (!current || !vidyaId) return;
    gradeMutation.mutate(
      { vidyaId, data: { itemId: current.id, quality } },
      {
        onSuccess: () => {
          setRevealed(false);
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
            <Brain className="w-5 h-5 text-violet-500" />
            <div>
              <h3 className="font-bold text-lg text-foreground leading-tight">
                {t("review.title")}
              </h3>
              <p className="text-xs text-muted-foreground">
                {t("review.subtitle")}
              </p>
            </div>
            {data && (
              <Badge variant="secondary" className="ml-auto font-bold">
                {t("review.progress")
                  .replace("{due}", String(data.dueCount))
                  .replace("{total}", String(data.totalCount))}
              </Badge>
            )}
          </div>

          {isLoading ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              {t("review.loading")}
            </p>
          ) : !current ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              {t("review.empty")}
            </p>
          ) : (
            <div className="space-y-4">
              {current.topic && (
                <Badge variant="outline" className="font-medium">
                  {t("review.topic")}: {current.topic}
                </Badge>
              )}
              <div className="rounded-2xl bg-violet-50 border border-violet-100 p-4">
                <p
                  data-testid="text-review-question"
                  className="text-base font-semibold text-foreground"
                >
                  {current.question}
                </p>
              </div>

              <AnimatePresence mode="wait">
                {!revealed ? (
                  <motion.div
                    key="reveal"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="space-y-3"
                  >
                    <p className="text-xs text-muted-foreground text-center">
                      {t("review.recallPrompt")}
                    </p>
                    <Button
                      type="button"
                      data-testid="button-review-reveal"
                      onClick={() => setRevealed(true)}
                      className="w-full h-11 rounded-xl font-semibold gap-2"
                    >
                      <Eye className="w-4 h-4" />
                      {t("review.reveal")}
                    </Button>
                  </motion.div>
                ) : (
                  <motion.div
                    key="grade"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="grid grid-cols-3 gap-2.5"
                  >
                    <Button
                      type="button"
                      variant="outline"
                      data-testid="button-review-missed"
                      disabled={gradeMutation.isPending}
                      onClick={() => grade(2)}
                      className="h-11 rounded-xl font-semibold hover:bg-red-50 hover:text-red-700 hover:border-red-300"
                    >
                      {t("review.missed")}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      data-testid="button-review-gotit"
                      disabled={gradeMutation.isPending}
                      onClick={() => grade(4)}
                      className="h-11 rounded-xl font-semibold hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300"
                    >
                      {t("review.gotIt")}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      data-testid="button-review-easy"
                      disabled={gradeMutation.isPending}
                      onClick={() => grade(5)}
                      className="h-11 rounded-xl font-semibold hover:bg-sky-50 hover:text-sky-700 hover:border-sky-300"
                    >
                      {t("review.easy")}
                    </Button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
