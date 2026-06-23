import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Library, Search } from "lucide-react";
import { useLanguage } from "@/lib/i18n";

type ConceptCategory =
  | "arithmetic"
  | "fractions"
  | "percentage"
  | "geometry"
  | "algebra";

type Concept = {
  id: string;
  category: ConceptCategory;
  nameKey: string;
  descKey: string;
  formula: string;
  example: string;
};

const CONCEPTS: Concept[] = [
  {
    id: "fractionAdd",
    category: "fractions",
    nameKey: "concept.item.fractionAdd.name",
    descKey: "concept.item.fractionAdd.desc",
    formula: "a/b + c/d = (a·d + c·b) / (b·d)",
    example: "1/2 + 1/3 = 5/6",
  },
  {
    id: "fractionMul",
    category: "fractions",
    nameKey: "concept.item.fractionMul.name",
    descKey: "concept.item.fractionMul.desc",
    formula: "a/b × c/d = (a·c) / (b·d)",
    example: "2/3 × 3/4 = 6/12 = 1/2",
  },
  {
    id: "decimalPlace",
    category: "fractions",
    nameKey: "concept.item.decimalPlace.name",
    descKey: "concept.item.decimalPlace.desc",
    formula: "0.1 = 1/10,  0.01 = 1/100",
    example: "3.45 = 3 + 4/10 + 5/100",
  },
  {
    id: "percentage",
    category: "percentage",
    nameKey: "concept.item.percentage.name",
    descKey: "concept.item.percentage.desc",
    formula: "x% of N = (x / 100) × N",
    example: "20% of 50 = (20/100) × 50 = 10",
  },
  {
    id: "average",
    category: "arithmetic",
    nameKey: "concept.item.average.name",
    descKey: "concept.item.average.desc",
    formula: "Mean = (sum of values) / (number of values)",
    example: "(4 + 6 + 8) / 3 = 6",
  },
  {
    id: "simpleInterest",
    category: "arithmetic",
    nameKey: "concept.item.simpleInterest.name",
    descKey: "concept.item.simpleInterest.desc",
    formula: "SI = (P × R × T) / 100",
    example: "P=1000, R=5%, T=2 → SI = 100",
  },
  {
    id: "rectArea",
    category: "geometry",
    nameKey: "concept.item.rectArea.name",
    descKey: "concept.item.rectArea.desc",
    formula: "Area = length × width",
    example: "5 × 3 = 15 sq units",
  },
  {
    id: "rectPerimeter",
    category: "geometry",
    nameKey: "concept.item.rectPerimeter.name",
    descKey: "concept.item.rectPerimeter.desc",
    formula: "Perimeter = 2 × (length + width)",
    example: "2 × (5 + 3) = 16 units",
  },
  {
    id: "triangleArea",
    category: "geometry",
    nameKey: "concept.item.triangleArea.name",
    descKey: "concept.item.triangleArea.desc",
    formula: "Area = ½ × base × height",
    example: "½ × 6 × 4 = 12 sq units",
  },
  {
    id: "circleArea",
    category: "geometry",
    nameKey: "concept.item.circleArea.name",
    descKey: "concept.item.circleArea.desc",
    formula: "Area = π × r²",
    example: "π × 7² = 154 sq units (π ≈ 22/7)",
  },
  {
    id: "circleCircum",
    category: "geometry",
    nameKey: "concept.item.circleCircum.name",
    descKey: "concept.item.circleCircum.desc",
    formula: "Circumference = 2 × π × r",
    example: "2 × 22/7 × 7 = 44 units",
  },
  {
    id: "linearEq",
    category: "algebra",
    nameKey: "concept.item.linearEq.name",
    descKey: "concept.item.linearEq.desc",
    formula: "x + a = b  →  x = b − a",
    example: "x + 5 = 12 → x = 7",
  },
];

const CATEGORIES: { id: ConceptCategory; key: string }[] = [
  { id: "arithmetic", key: "concept.cat.arithmetic" },
  { id: "fractions", key: "concept.cat.fractions" },
  { id: "percentage", key: "concept.cat.percentage" },
  { id: "geometry", key: "concept.cat.geometry" },
  { id: "algebra", key: "concept.cat.algebra" },
];

export default function ConceptLibrary() {
  const { t } = useLanguage();
  const [search, setSearch] = useState("");
  const [activeCat, setActiveCat] = useState<ConceptCategory | "all">("all");

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
            {CATEGORIES.map((cat) => (
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
              {filtered.map((c) => (
                <div
                  key={c.id}
                  data-testid={`card-concept-${c.id}`}
                  className="rounded-2xl bg-gray-50 border border-gray-100 p-4 space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-sm font-bold text-foreground">
                      {t(c.nameKey)}
                    </h4>
                    <Badge variant="outline" className="text-[10px] shrink-0">
                      {t(CATEGORIES.find((cat) => cat.id === c.category)!.key)}
                    </Badge>
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
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
