import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bookmark, Trash2 } from "lucide-react";
import {
  useGetBookmarks,
  getGetBookmarksQueryKey,
  useRemoveBookmark,
} from "@workspace/api-client-react";
import { useLanguage } from "@/lib/i18n";

export default function BookmarksPanel({ vidyaId }: { vidyaId: string }) {
  const { t } = useLanguage();

  const { data, isLoading, refetch } = useGetBookmarks(vidyaId, {
    query: { enabled: !!vidyaId, queryKey: getGetBookmarksQueryKey(vidyaId) },
  });
  const removeMutation = useRemoveBookmark();
  const bookmarks = data?.bookmarks ?? [];

  const remove = (kind: string, refId: string) => {
    removeMutation.mutate(
      { vidyaId, kind, refId },
      { onSuccess: () => refetch() },
    );
  };

  const kindLabel = (kind: string) =>
    kind === "concept" ? t("bookmarks.kindConcept") : t("bookmarks.kindQuestion");

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
    >
      <Card className="border-0 shadow-md rounded-2xl overflow-hidden">
        <CardContent className="p-6 space-y-5">
          <div className="flex items-center gap-2">
            <Bookmark className="w-5 h-5 text-amber-500" />
            <div>
              <h3 className="font-bold text-lg text-foreground leading-tight">
                {t("bookmarks.title")}
              </h3>
              <p className="text-xs text-muted-foreground">
                {t("bookmarks.subtitle")}
              </p>
            </div>
          </div>

          {isLoading ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              {t("bookmarks.loading")}
            </p>
          ) : bookmarks.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              {t("bookmarks.empty")}
            </p>
          ) : (
            <div className="space-y-2">
              {bookmarks.map((b) => (
                <div
                  key={b.id}
                  data-testid={`card-bookmark-${b.id}`}
                  className="rounded-2xl bg-gray-50 border border-gray-100 p-4 flex items-start gap-3"
                >
                  <Bookmark className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground text-sm truncate">
                        {b.label}
                      </span>
                      <Badge variant="outline" className="text-[10px] shrink-0">
                        {kindLabel(b.kind)}
                      </Badge>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 text-muted-foreground hover:text-red-600"
                    data-testid={`button-bookmark-remove-${b.id}`}
                    aria-label={t("bookmarks.remove")}
                    disabled={removeMutation.isPending}
                    onClick={() => remove(b.kind, b.refId)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
