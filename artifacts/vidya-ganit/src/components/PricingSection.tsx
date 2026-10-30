import { useEffect, useState } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth";
import { useLanguage } from "@/lib/i18n";
import { subscribeToPlan } from "@/lib/payments";
import {
  Sparkles,
  CheckCircle2,
  Crown,
  ShieldCheck,
  FlaskConical,
  Clock,
  Zap,
  ArrowRight,
  Wallet,
  Building2,
  CreditCard,
  Loader2,
} from "lucide-react";

type Mode = "live" | "demo" | "mock" | "off" | null;

// Keep these in step with the API: the amounts are paymentCatalog.ts (what is
// actually charged) and the limits are FREE_LIMITS / PAID_LIMITS in planAccess.ts
// (they also appear inside the pricing.* translations).
const PRICES = {
  family_plus: { monthly: 249, yearly: 2499 },
  tutor_pro: { monthly: 599, yearly: 5999 },
} as const;

const FAMILY_FEATURES = ["f1", "f2", "f3", "f4", "f5"] as const;
const TUTOR_FEATURES = ["f1", "f2", "f3", "f4", "f5", "f6"] as const;

export default function PricingSection() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/payments/catalog")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => alive && setMode((data?.mode as Mode) ?? null))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  const paymentsOff = mode === "off";
  const isDemo = mode === "demo";
  const unit = t(billingCycle === "monthly" ? "pricing.perMonth" : "pricing.perYear");

  const handleSubscribe = async (planCode: "family_plus" | "tutor_pro") => {
    if (!user) return;
    try {
      setLoadingPlan(planCode);
      const outcome = await subscribeToPlan({
        vidyaId: user.vidyaId,
        planCode,
        billingCycle,
        userName: user.name,
      });
      if (outcome.status === "paid") {
        alert(t(isDemo ? "pricing.demoDone" : "pricing.paid"));
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : t("pricing.failed"));
    } finally {
      setLoadingPlan(null);
    }
  };

  const familyPrice = PRICES.family_plus[billingCycle];
  const tutorPrice = PRICES.tutor_pro[billingCycle];
  const savePercent = Math.round(100 - (PRICES.family_plus.yearly / (PRICES.family_plus.monthly * 12)) * 100);

  const badge =
    mode === "live" ? (
      <>
        <ShieldCheck className="w-4 h-4 text-emerald-600" />
        <span>{t("pricing.badge.live")}</span>
      </>
    ) : isDemo ? (
      <>
        <FlaskConical className="w-4 h-4 text-amber-600" />
        <span>{t("pricing.badge.demo")}</span>
      </>
    ) : paymentsOff ? (
      <>
        <Clock className="w-4 h-4 text-amber-600" />
        <span>{t("pricing.badge.off")}</span>
      </>
    ) : (
      <span>{t("pricing.badge.default")}</span>
    );

  const subscribeLabel = (name: string, price: number) => {
    if (paymentsOff) return t("pricing.launching");
    const shown = price.toLocaleString("en-IN");
    return t(isDemo ? "pricing.tryDemo" : "pricing.subscribe")
      .replace("{plan}", name)
      .replace("{price}", shown);
  };
  const getStarted = (name: string) => t("pricing.getStarted").replace("{plan}", name);

  return (
    <section
      id="pricing"
      className="relative z-10 w-full max-w-6xl mx-auto px-6 py-20 flex flex-col items-center"
      data-testid="section-pricing"
    >
      {/* Section Header */}
      <div className="text-center max-w-3xl mx-auto mb-12">
        <div
          className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full border text-xs md:text-sm font-bold mb-4 shadow-sm ${
            isDemo || paymentsOff
              ? "bg-amber-50 border-amber-200 text-amber-800"
              : "bg-emerald-50 border-emerald-200 text-emerald-800"
          }`}
          data-testid="badge-payments-mode"
        >
          {badge}
        </div>
        <h2 className="text-4xl md:text-5xl font-black text-slate-800 tracking-tight leading-tight">
          {t("pricing.title1")} <span className="text-indigo-600">{t("pricing.title2")}</span>
        </h2>
        <p className="text-lg md:text-xl text-slate-600 mt-4 leading-relaxed font-medium">
          {t("pricing.subtitle")}
        </p>

        {/* Monthly / Yearly Billing Toggle */}
        <div className="mt-8 inline-flex items-center bg-slate-100 p-1.5 rounded-2xl border border-slate-200 shadow-inner">
          <button
            type="button"
            onClick={() => setBillingCycle("monthly")}
            className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${
              billingCycle === "monthly" ? "bg-white text-indigo-700 shadow-sm" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            {t("pricing.monthly")}
          </button>
          <button
            type="button"
            onClick={() => setBillingCycle("yearly")}
            className={`flex items-center gap-1.5 px-6 py-2 rounded-xl text-sm font-bold transition-all ${
              billingCycle === "yearly" ? "bg-white text-indigo-700 shadow-sm" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <span>{t("pricing.yearly")}</span>
            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
              {t("pricing.save").replace("{pct}", String(savePercent))}
            </span>
          </button>
        </div>
      </div>

      {/* Pricing Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-5xl">
        {/* Tier 1: Family Plus */}
        <motion.div
          whileHover={{ y: -6 }}
          transition={{ duration: 0.2 }}
          className="relative flex flex-col bg-white rounded-3xl p-8 border-2 border-indigo-100 shadow-[0_8px_30px_rgb(0,0,0,0.06)]"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
              <Sparkles className="w-6 h-6" />
            </div>
            <Badge variant="outline" className="text-xs font-semibold px-3 py-1 border-indigo-200 text-indigo-700 bg-indigo-50/50">
              {t("pricing.forFamilies")}
            </Badge>
          </div>

          <h3 className="text-2xl font-black text-slate-800">Family Plus</h3>
          <p className="text-slate-600 text-sm mt-1 mb-6 font-medium">{t("pricing.family.desc")}</p>

          <div className="flex items-baseline gap-1 mb-2">
            <span className="text-4xl md:text-5xl font-black text-slate-900">₹{familyPrice.toLocaleString("en-IN")}</span>
            <span className="text-slate-500 font-semibold text-sm">{unit}</span>
          </div>
          <p className="text-xs text-slate-500 font-medium mb-8">{t("pricing.billed")}</p>

          <ul className="space-y-3.5 flex-1 mb-8">
            {FAMILY_FEATURES.map((f) => (
              <li key={f} className="flex items-start gap-3 text-sm text-slate-700 font-medium">
                <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                <span>{t(`pricing.family.${f}`)}</span>
              </li>
            ))}
          </ul>

          {user?.role === "parent" ? (
            <Button
              onClick={() => handleSubscribe("family_plus")}
              disabled={loadingPlan === "family_plus" || paymentsOff}
              data-testid="button-pricing-family"
              className="w-full rounded-2xl h-14 text-base font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-[0_4px_0_0_rgba(79,70,229,0.5)] transition-all"
            >
              {loadingPlan === "family_plus" ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Zap className="w-5 h-5 mr-2" />}
              {subscribeLabel("Family Plus", familyPrice)}
            </Button>
          ) : (
            <Link href="/auth?mode=register&role=parent" className="block w-full">
              <Button className="w-full rounded-2xl h-14 text-base font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-[0_4px_0_0_rgba(79,70,229,0.5)] transition-all">
                {getStarted("Family Plus")}
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </Link>
          )}
        </motion.div>

        {/* Tier 2: Tutor Pro */}
        <motion.div
          whileHover={{ y: -6 }}
          transition={{ duration: 0.2 }}
          className="relative flex flex-col bg-gradient-to-b from-indigo-900 via-indigo-950 to-slate-950 rounded-3xl p-8 border-2 border-indigo-500/30 text-white shadow-[0_8px_30px_rgb(79,70,229,0.15)]"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-amber-400">
              <Crown className="w-6 h-6" />
            </div>
            <Badge variant="outline" className="text-xs font-semibold px-3 py-1 border-indigo-400/30 text-indigo-200 bg-indigo-500/10">
              {t("pricing.forEducators")}
            </Badge>
          </div>

          <h3 className="text-2xl font-black text-white">Tutor Pro</h3>
          <p className="text-indigo-200 text-sm mt-1 mb-6 font-medium">{t("pricing.tutor.desc")}</p>

          <div className="flex items-baseline gap-1 mb-2">
            <span className="text-4xl md:text-5xl font-black text-white">₹{tutorPrice.toLocaleString("en-IN")}</span>
            <span className="text-indigo-300 font-semibold text-sm">{unit}</span>
          </div>
          <p className="text-xs text-indigo-300/80 font-medium mb-8">{t("pricing.billed")}</p>

          <ul className="space-y-3.5 flex-1 mb-8">
            {TUTOR_FEATURES.map((f) => (
              <li key={f} className="flex items-start gap-3 text-sm text-indigo-100 font-medium">
                <CheckCircle2 className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <span>{t(`pricing.tutor.${f}`)}</span>
              </li>
            ))}
          </ul>

          {user?.role === "tutor" ? (
            <Button
              onClick={() => handleSubscribe("tutor_pro")}
              disabled={loadingPlan === "tutor_pro" || paymentsOff}
              data-testid="button-pricing-tutor"
              className="w-full rounded-2xl h-14 text-base font-bold bg-amber-400 hover:bg-amber-300 text-slate-950 shadow-[0_4px_0_0_rgba(217,119,6,0.6)] transition-all"
            >
              {loadingPlan === "tutor_pro" ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Crown className="w-5 h-5 mr-2" />}
              {subscribeLabel("Tutor Pro", tutorPrice)}
            </Button>
          ) : (
            <Link href="/auth?mode=register&role=tutor" className="block w-full">
              <Button className="w-full rounded-2xl h-14 text-base font-bold bg-amber-400 hover:bg-amber-300 text-slate-950 shadow-[0_4px_0_0_rgba(217,119,6,0.6)] transition-all">
                {getStarted("Tutor Pro")}
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </Link>
          )}
        </motion.div>
      </div>

      {/* Parent Tuition Payment Callout */}
      <div className="w-full max-w-5xl mt-12 bg-indigo-50 border-2 border-indigo-200/80 rounded-3xl p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-md">
            <Wallet className="w-6 h-6" />
          </div>
          <div>
            <h4 className="text-lg font-black text-slate-900">{t("pricing.fee.title")}</h4>
            <p className="text-sm text-slate-600 mt-1 max-w-xl">{t("pricing.fee.body")}</p>
          </div>
        </div>
        <Link href={user?.role === "parent" ? "/dashboard/parent" : "/auth?mode=login"}>
          <Button
            variant="outline"
            className="rounded-xl font-bold border-2 border-indigo-300 bg-white text-indigo-700 hover:bg-indigo-100/50 shrink-0 h-12 px-6"
          >
            {t("pricing.fee.cta")}
          </Button>
        </Link>
      </div>

      {/* Payment methods: only when real payments are on */}
      {mode === "live" && (
        <div className="mt-12 flex flex-wrap items-center justify-center gap-6 text-slate-500 text-xs font-semibold">
          <div className="flex items-center gap-1.5">
            <CreditCard className="w-4 h-4 text-indigo-600" />
            <span>{t("pricing.methods.upi")}</span>
          </div>
          <span>•</span>
          <div className="flex items-center gap-1.5">
            <Building2 className="w-4 h-4 text-indigo-600" />
            <span>{t("pricing.methods.cards")}</span>
          </div>
        </div>
      )}
    </section>
  );
}
