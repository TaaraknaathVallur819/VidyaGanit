import { useState } from "react";
import { motion } from "framer-motion";
import { Loader2, BookOpen, ListChecks, CheckCircle2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import {
  useGetClassCurriculum,
  getGetClassCurriculumQueryKey,
} from "@workspace/api-client-react";
import { useLanguage } from "@/lib/i18n";

const CLASSES = ["4", "5", "6", "7"] as const;
type ClassValue = (typeof CLASSES)[number];

export default function CurriculumPlanner() {
  const { t } = useLanguage();
  const [selectedClass, setSelectedClass] = useState<ClassValue>("4");

  const { data, isLoading } = useGetClassCurriculum(selectedClass, {
    query: { queryKey: getGetClassCurriculumQueryKey(selectedClass) },
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-primary" />
          {t("curriculum.title")}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">{t("curriculum.subtitle")}</p>
      </div>

      {/* Class selector */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm font-medium text-muted-foreground mr-1">
          {t("curriculum.class")}
        </span>
        {CLASSES.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setSelectedClass(c)}
            data-testid={`curriculum-class-${c}`}
            className={`w-11 h-11 rounded-xl text-sm font-bold border-2 transition-all ${
              selectedClass === c
                ? "border-primary bg-primary/5 text-primary"
                : "border-muted text-muted-foreground hover:border-primary/30"
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="w-6 h-6 animate-spin text-primary mr-2" />
          {t("curriculum.loading")}
        </div>
      ) : (
        <div className="space-y-4">
          {(data?.units ?? []).map((unit, i) => (
            <motion.div
              key={unit.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.06 }}
            >
              <Card className="border-0 shadow-sm rounded-2xl overflow-hidden">
                <CardContent className="p-5">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-foreground">{unit.title}</h3>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        {unit.description}
                      </p>
                      <div className="mt-3">
                        <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5 mb-2">
                          <ListChecks className="w-3.5 h-3.5" />
                          {t("curriculum.lessonsLabel")}
                        </p>
                        <ul className="space-y-1.5">
                          {unit.lessons.map((lesson) => (
                            <li
                              key={lesson}
                              className="flex items-start gap-2 text-sm text-foreground/90"
                            >
                              <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                              {lesson}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
