import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, Crown } from "lucide-react";
import {
  useGetLeaderboard,
  getGetLeaderboardQueryKey,
} from "@workspace/api-client-react";
import { useLanguage } from "@/lib/i18n";

export default function Leaderboard({ vidyaId }: { vidyaId: string }) {
  const { t } = useLanguage();

  const { data, isLoading } = useGetLeaderboard(vidyaId, {
    query: { enabled: !!vidyaId, queryKey: getGetLeaderboardQueryKey(vidyaId) },
  });

  const entries = data?.entries ?? [];
  const visible = entries;
  // The server picks the most relevant peer group (batch → class → global) and
  // returns it in `scope`; we surface that as a read-only label.
  const scopeLabel =
    data?.scope === "batch"
      ? t("leaderboard.scope.batch")
      : data?.scope === "class"
        ? t("leaderboard.scope.class")
        : t("leaderboard.scope.all");

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
    >
      <Card className="border-0 shadow-md rounded-2xl overflow-hidden">
        <CardContent className="p-6 space-y-5">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-500" />
            <div>
              <h3 className="font-bold text-lg text-foreground leading-tight">
                {t("leaderboard.title")}
              </h3>
              <p className="text-xs text-muted-foreground">
                {t("leaderboard.subtitle")}
              </p>
            </div>
            {data && (
              <Badge
                variant="secondary"
                className="ml-auto text-sm font-bold px-3 py-1"
              >
                {t("leaderboard.yourRank").replace("{rank}", String(data.selfRank))}
              </Badge>
            )}
          </div>

          {data && (
            <div className="flex">
              <Badge
                variant="outline"
                data-testid="badge-leaderboard-scope"
                className="rounded-full text-xs font-semibold"
              >
                {scopeLabel}
              </Badge>
            </div>
          )}

          {isLoading ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              {t("leaderboard.loading")}
            </p>
          ) : visible.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              {t("leaderboard.empty")}
            </p>
          ) : (
            <div className="space-y-2">
              {visible.map((e) => (
                <div
                  key={`${e.rank}-${e.name}`}
                  data-testid={`row-leaderboard-${e.rank}`}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 border ${
                    e.isSelf
                      ? "bg-primary/5 border-primary/30"
                      : "bg-gray-50 border-gray-100"
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${
                      e.rank === 1
                        ? "bg-amber-100 text-amber-700"
                        : e.rank === 2
                          ? "bg-gray-200 text-gray-700"
                          : e.rank === 3
                            ? "bg-orange-100 text-orange-700"
                            : "bg-white text-muted-foreground border"
                    }`}
                  >
                    {e.rank <= 3 ? <Crown className="w-4 h-4" /> : e.rank}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">
                      {e.name}
                      {e.isSelf && (
                        <span className="ml-2 text-xs text-primary font-bold">
                          {t("leaderboard.you")}
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t("leaderboard.level")} {e.level}
                    </p>
                  </div>
                  <Badge variant="secondary" className="font-bold">
                    {e.xp} XP
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
