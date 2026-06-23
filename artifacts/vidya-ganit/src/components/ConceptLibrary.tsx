import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Library, Search, Bookmark, BookmarkCheck } from "lucide-react";
import {
  useGetBookmarks,
  getGetBookmarksQueryKey,
  useAddBookmark,
  useRemoveBookmark,
} from "@workspace/api-client-react";
import { CONCEPTS, CONCEPT_CATEGORIES, type ConceptCategory } from "@/lib/concepts";
import { useLanguage } from "@/lib/i18n";

export default function ConceptLibrary({ vidyaId }: { vidyaId?: string }) {
  const { t } = useLanguage();
  const [search, setSearch] = useState("");
  const [activeCat, setActiveCat] = useState<ConceptCategory | "all">("all");

  const { data: bookmarkData, refetch: refetchBookmarks } = useGetBookmarks(
    vidyaId ?? "",
    {
      query: {
        enabled: !!vidyaId,
        queryKey: getGetBookmarksQueryKey(vidyaId ?? ""),
      },
    },
  );
  const addMutation = useAddBookmark();
  const removeMutation = useRemoveBookmark();
  const savedIds = useMemo(
    () =>
      new Set(
        (bookmarkData?.bookmarks ?? [])
          .filter((b) => b.kind === "concept")
          .map((b) => b.refId),
      ),
    [bookmarkData],
  );

  const toggleBookmark = (conceptId: string, label: string) => {
    if (!vidyaId) return;
    if (savedIds.has(conceptId)) {
      removeMutation.mutate(
        { vidyaId, kind: "concept", refId: conceptId },
        { onSuccess: () => refetchBookmarks() },
      );
    } else {
      addMutation.mutate(
        { vidyaId, data: { kind: "concept", refId: conceptId, label } },
        { onSuccess: () => refetchBookmarks() },
      );
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return CONCEPTS.filter((c) => {
      if (activeCat !== "all" && c.category !== activeCat) return false;
      if (!q) return true;
      const haystack = `${t(c.nameKey)} ${t(c.descKey)} ${c.formula} ${c.example}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [search, activeCat, t]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
    >
      <Card className="border-0 shadow-md rounded-2xl overflow-hidden">
        <CardContent className="p-6 space-y-5">
          <div className="flex items-center gap-2">
            <Library className="w-5 h-5 text-teal-500" />
            <div>
              <h3 className="font-bold text-lg text-foreground leading-tight">
                {t("concept.title")}
              </h3>
              <p className="text-xs text-muted-foreground">
                {t("concept.subtitle")}
              </p>
            </div>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              data-testid="input-concept-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("concept.search")}
              className="pl-9 h-11 rounded-xl"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant={activeCat === "all" ? "default" : "outline"}
              data-testid="button-concept-cat-all"
              onClick={() => setActiveCat("all")}
              className="rounded-full"
            >
              {t("concept.all")}
            </Button>
            {CONCEPT_CATEGORIES.map((cat) => (
              <Button
                key={cat.id}
                type="button"
                size="sm"
                variant={activeCat === cat.id ? "default" : "outline"}
                data-testid={`button-concept-cat-${cat.id}`}
                onClick={() => setActiveCat(cat.id)}
                className="rounded-full"
              >
                {t(cat.key)}
              </Button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              {t("concept.empty")}
            </p>
          ) : (
            <div className="grid sm:grid-cols-2 gap-3">
              {filtered.map((c) => {
                const saved = savedIds.has(c.id);
                return (
                  <div
                    key={c.id}
                    data-testid={`card-concept-${c.id}`}
                    className="rounded-2xl bg-gray-50 border border-gray-100 p-4 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="text-sm font-bold text-foreground">
                        {t(c.nameKey)}
                      </h4>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Badge variant="outline" className="text-[10px]">
                          {t(
                            CONCEPT_CATEGORIES.find((cat) => cat.id === c.category)!
                              .key,
                          )}
                        </Badge>
                        {vidyaId && (
                          <button
                            type="button"
                            data-testid={`button-concept-bookmark-${c.id}`}
                            aria-label={
                              saved
                                ? t("concept.bookmarkRemove")
                                : t("concept.bookmark")
                            }
                            onClick={() => toggleBookmark(c.id, t(c.nameKey))}
                            className={`p-1 rounded-md transition-colors ${
                              saved
                                ? "text-amber-500"
                                : "text-muted-foreground hover:text-amber-500"
                            }`}
                          >
                            {saved ? (
                              <BookmarkCheck className="w-4 h-4" />
                            ) : (
                              <Bookmark className="w-4 h-4" />
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {t(c.descKey)}
                    </p>
                    <div className="rounded-xl bg-white border border-gray-100 p-2.5">
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                        {t("concept.formula")}
                      </p>
                      <p className="text-sm font-mono text-foreground mt-0.5">
                        {c.formula}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                        {t("concept.example")}
                      </p>
                      <p className="text-sm font-mono text-teal-700 mt-0.5">
                        {c.example}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
