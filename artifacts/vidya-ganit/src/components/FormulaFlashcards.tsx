import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Layers, ChevronLeft, ChevronRight, Shuffle, RotateCcw } from "lucide-react";
import { CONCEPTS, CONCEPT_CATEGORIES } from "@/lib/concepts";
import { useLanguage } from "@/lib/i18n";

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function FormulaFlashcards() {
  const { t } = useLanguage();
  const [order, setOrder] = useState<number[]>(() =>
    CONCEPTS.map((_, i) => i),
  );
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);

  const card = useMemo(() => CONCEPTS[order[index]], [order, index]);
  const categoryLabel = (catId: string) =>
    t(CONCEPT_CATEGORIES.find((c) => c.id === catId)?.key ?? "");

  const go = (delta: number) => {
    setFlipped(false);
    setIndex((prev) => (prev + delta + order.length) % order.length);
  };

  const reshuffle = () => {
    setFlipped(false);
    setOrder(shuffleArray(CONCEPTS.map((_, i) => i)));
    setIndex(0);
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
            <Layers className="w-5 h-5 text-violet-500" />
            <div>
              <h3 className="font-bold text-lg text-foreground leading-tight">
                {t("flashcards.title")}
              </h3>
              <p className="text-xs text-muted-foreground">
                {t("flashcards.subtitle")}
              </p>
            </div>
            <Badge variant="secondary" className="ml-auto font-bold tabular-nums">
              {index + 1} / {order.length}
            </Badge>
          </div>

          <div className="relative" style={{ perspective: 1200 }}>
            <button
              type="button"
              data-testid="button-flashcard-flip"
              onClick={() => setFlipped((f) => !f)}
              className="w-full text-left"
              aria-label={t("flashcards.tapToFlip")}
            >
              <div className="relative h-56" style={{ transformStyle: "preserve-3d" }}>
                <AnimatePresence initial={false} mode="wait">
                  <motion.div
                    key={`${card.id}-${flipped ? "back" : "front"}`}
                    initial={{ rotateY: 90, opacity: 0 }}
                    animate={{ rotateY: 0, opacity: 1 }}
                    exit={{ rotateY: -90, opacity: 0 }}
                    transition={{ duration: 0.28 }}
                    className={`absolute inset-0 rounded-2xl border p-6 flex flex-col ${
                      flipped
                        ? "bg-gradient-to-br from-violet-500 to-fuchsia-600 text-white border-transparent"
                        : "bg-gray-50 border-gray-100"
                    }`}
                  >
                    {flipped ? (
                      <>
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-white/70">
                          {t("concept.formula")}
                        </p>
                        <p
                          className="text-lg font-mono mt-1"
                          data-testid="text-flashcard-formula"
                        >
                          {card.formula}
                        </p>
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-white/70 mt-4">
                          {t("flashcards.example")}
                        </p>
                        <p className="text-base font-mono mt-1">{card.example}</p>
                        <p className="text-xs text-white/80 mt-auto pt-3">
                          {t("flashcards.tapToFlip")}
                        </p>
                      </>
                    ) : (
                      <>
                        <Badge variant="outline" className="self-start text-[10px]">
                          {categoryLabel(card.category)}
                        </Badge>
                        <h4 className="text-xl font-bold text-foreground mt-3">
                          {t(card.nameKey)}
                        </h4>
                        <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                          {t(card.descKey)}
                        </p>
                        <p className="text-xs text-violet-600 font-semibold mt-auto pt-3">
                          {t("flashcards.front")} · {t("flashcards.tapToFlip")}
                        </p>
                      </>
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1 rounded-xl gap-1.5"
              data-testid="button-flashcard-prev"
              onClick={() => go(-1)}
            >
              <ChevronLeft className="w-4 h-4" />
              {t("flashcards.prev")}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="rounded-xl"
              data-testid="button-flashcard-flip-toggle"
              aria-label={t("flashcards.tapToFlip")}
              onClick={() => setFlipped((f) => !f)}
            >
              <RotateCcw className="w-4 h-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="rounded-xl"
              data-testid="button-flashcard-shuffle"
              aria-label={t("flashcards.shuffle")}
              onClick={reshuffle}
            >
              <Shuffle className="w-4 h-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              className="flex-1 rounded-xl gap-1.5"
              data-testid="button-flashcard-next"
              onClick={() => go(1)}
            >
              {t("flashcards.next")}
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
