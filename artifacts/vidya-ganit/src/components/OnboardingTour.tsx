import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/lib/i18n";
import { Sparkles, X } from "lucide-react";

const STORAGE_PREFIX = "vidyaganit_tour_seen_";

const STEPS = [
  { emoji: "👋", titleKey: "tour.step.welcome.title", bodyKey: "tour.step.welcome.body" },
  { emoji: "💬", titleKey: "tour.step.workspace.title", bodyKey: "tour.step.workspace.body" },
  { emoji: "🏆", titleKey: "tour.step.progress.title", bodyKey: "tour.step.progress.body" },
  { emoji: "🛍️", titleKey: "tour.step.shop.title", bodyKey: "tour.step.shop.body" },
];

export default function OnboardingTour({ userKey }: { userKey: string }) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  const storageKey = userKey ? `${STORAGE_PREFIX}${userKey}` : "";

  useEffect(() => {
    if (!storageKey) return;
    try {
      if (window.localStorage.getItem(storageKey) !== "1") {
        setOpen(true);
        setStep(0);
      }
    } catch {
      // ignore storage errors
    }
  }, [storageKey]);

  const finish = () => {
    setOpen(false);
    try {
      if (storageKey) window.localStorage.setItem(storageKey, "1");
    } catch {
      // ignore storage errors
    }
  };

  const isLast = step === STEPS.length - 1;
  const current = STEPS[step];

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          data-testid="onboarding-tour"
        >
          <motion.div
            className="w-full max-w-md rounded-3xl bg-card text-card-foreground shadow-2xl overflow-hidden"
            initial={{ scale: 0.9, y: 20, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.9, y: 20, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 26 }}
          >
            <div className="relative h-28 bg-gradient-to-r from-primary via-primary/80 to-secondary flex items-center justify-center">
              <Sparkles className="w-7 h-7 text-white/80 absolute left-5 top-5" />
              <button
                type="button"
                onClick={finish}
                aria-label={t("tour.skip")}
                data-testid="button-tour-skip"
                className="absolute right-4 top-4 text-white/80 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
              <motion.span
                key={current.emoji}
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-5xl"
              >
                {current.emoji}
              </motion.span>
            </div>

            <div className="p-6 space-y-3">
              <h2 className="text-xl font-bold text-foreground">{t(current.titleKey)}</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {t(current.bodyKey)}
              </p>

              <div className="flex items-center justify-center gap-1.5 pt-1">
                {STEPS.map((_, i) => (
                  <span
                    key={i}
                    className={`h-1.5 rounded-full transition-all ${
                      i === step ? "w-5 bg-primary" : "w-1.5 bg-muted"
                    }`}
                  />
                ))}
              </div>

              <div className="flex items-center justify-between gap-3 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  className="rounded-full text-muted-foreground"
                  onClick={finish}
                  data-testid="button-tour-skip-text"
                >
                  {t("tour.skip")}
                </Button>
                <div className="flex items-center gap-2">
                  {step > 0 && (
                    <Button
                      type="button"
                      variant="outline"
                      className="rounded-full"
                      onClick={() => setStep((s) => s - 1)}
                      data-testid="button-tour-back"
                    >
                      {t("tour.back")}
                    </Button>
                  )}
                  <Button
                    type="button"
                    className="rounded-full px-6"
                    onClick={() => (isLast ? finish() : setStep((s) => s + 1))}
                    data-testid="button-tour-next"
                  >
                    {isLast ? t("tour.done") : t("tour.next")}
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
