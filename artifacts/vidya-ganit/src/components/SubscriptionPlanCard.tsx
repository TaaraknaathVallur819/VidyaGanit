import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sparkles,
  CheckCircle2,
  Crown,
  Loader2,
  FlaskConical,
  LifeBuoy,
  Zap,
} from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { subscribeToPlan } from "@/lib/payments";
import { PLAN_FOR_ROLE, hasPlanFor, usePlanStatus } from "@/lib/planStatus";

// Keep these numbers in step with FREE_LIMITS / PAID_LIMITS in the API (planAccess.ts)
// and the amounts in paymentCatalog.ts, which is what is actually charged.
const PRICES = {
  parent: { monthly: 1000, yearly: 9000 },
  tutor: { monthly: 2000, yearly: 18000 },
} as const;

const FEATURES = {
  parent: [
    "Strategy AI: an AI advisor for supporting your child",
    "Weekly learning insights and report cards you can share on WhatsApp",
    "Personalised worksheets, with answer keys",
    "Link up to 4 children (free plan: 1)",
    "Unlimited games for every linked child (free plan: 5 a day)",
  ],
  tutor: [
    "The AI Coach and the class heatmap",
    "Worksheets targeted at your class's weak spots",
    "WhatsApp-ready progress cards",
    "Link unlimited students (free plan: 5)",
    "Online tuition fee collection through Razorpay Route",
    "Priority support by email",
  ],
} as const;

export default function SubscriptionPlanCard({
  vidyaId,
  role,
  userName,
}: {
  vidyaId: string;
  role: "parent" | "tutor";
  userName?: string;
}) {
  const { t } = useLanguage();
  const status = usePlanStatus(vidyaId);
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const plan = PLAN_FOR_ROLE[role];
  const planCode = plan.code as "family_plus" | "tutor_pro";
  const price = PRICES[role][billingCycle];
  const savePercent = Math.round(100 - (PRICES[role].yearly / (PRICES[role].monthly * 12)) * 100);
  const isActive = hasPlanFor(status, role);
  const isLoading = status === undefined;
  const paymentsOff = status != null && !status.paymentsEnabled;
  const isDemo = status?.mode === "demo";
  const endsOn = status?.plan?.currentEnd
    ? new Date(status.plan.currentEnd).toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : null;

  const handleSubscribe = async () => {
    setIsSubscribing(true);
    setFeedback(null);
    try {
      const outcome = await subscribeToPlan({ vidyaId, planCode, billingCycle, userName });
      if (outcome.status === "paid") {
        setFeedback(`You are now subscribed to ${plan.name}.`);
      }
    } catch (err: unknown) {
      setFeedback(err instanceof Error ? err.message : "Could not start the payment.");
    } finally {
      setIsSubscribing(false);
    }
  };

  const [supportBefore, supportAfter] = t("support.priority").split("{email}");

  return (
    <Card className="rounded-3xl border-2 border-indigo-100 bg-gradient-to-br from-white via-indigo-50/30 to-violet-50/20 shadow-md overflow-hidden">
      <div className="p-6 border-b border-indigo-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Crown className="w-5 h-5 text-amber-500" />
          <h3 className="font-black text-slate-800 text-lg">{plan.name} Membership</h3>
        </div>
        {isActive ? (
          <Badge className="bg-emerald-600 text-white font-bold gap-1 px-3 py-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Active Plan
          </Badge>
        ) : (
          <Badge variant="outline" className="border-indigo-300 text-indigo-700 bg-indigo-50 font-bold">
            Upgrade Available
          </Badge>
        )}
      </div>

      <CardContent className="p-6 space-y-6">
        {isDemo && (
          <div className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">
            <FlaskConical className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              {t("demo.banner")} {t("demo.planNote")}
            </span>
          </div>
        )}

        {paymentsOff && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
            {t("upgrade.paymentsSoon").replace("{plan}", plan.name)}
          </div>
        )}

        {feedback && (
          <div className="p-4 rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-900 text-sm font-semibold flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
            <span>{feedback}</span>
          </div>
        )}

        {/* Pricing & Cycle Toggle */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
          <div>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-black text-slate-800">₹{price.toLocaleString("en-IN")}</span>
              <span className="text-xs text-slate-400 font-medium">
                /{billingCycle === "monthly" ? "month" : "year"}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">Prices in Indian rupees (INR)</p>
          </div>

          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setBillingCycle("monthly")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                billingCycle === "monthly"
                  ? "bg-white text-indigo-700 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setBillingCycle("yearly")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                billingCycle === "yearly"
                  ? "bg-white text-indigo-700 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Yearly
              <span className="bg-emerald-100 text-emerald-700 text-[10px] px-1.5 py-0.5 rounded-full font-black">
                Save {savePercent}%
              </span>
            </button>
          </div>
        </div>

        {/* Features Checklist */}
        <div className="space-y-2.5">
          <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
            Included in {plan.name}:
          </h4>
          <div className="grid grid-cols-1 gap-2">
            {FEATURES[role].map((feature) => (
              <div key={feature} className="flex items-start gap-2.5 text-xs text-slate-600">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <span>{feature}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Action */}
        <div className="space-y-3">
          {isActive ? (
            <>
              <div className="text-center py-2 text-xs font-medium text-emerald-700 bg-emerald-50 rounded-xl border border-emerald-200">
                Your {plan.name} membership is active{endsOn ? ` until ${endsOn}` : ""}.
              </div>
              {role === "tutor" && status?.supportEmail && (
                <div className="flex items-start gap-2 rounded-xl border border-indigo-100 bg-white px-3 py-2 text-xs text-slate-600">
                  <LifeBuoy className="mt-0.5 h-4 w-4 shrink-0 text-indigo-500" />
                  <span>
                    {supportBefore}
                    <a
                      className="font-semibold text-indigo-700 underline"
                      href={`mailto:${status.supportEmail}?subject=${encodeURIComponent("VidyaGanit priority support")}`}
                    >
                      {status.supportEmail}
                    </a>
                    {supportAfter}
                  </span>
                </div>
              )}
            </>
          ) : (
            <Button
              onClick={handleSubscribe}
              disabled={isSubscribing || isLoading || paymentsOff}
              data-testid={`button-upgrade-${planCode}`}
              className="w-full h-12 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm shadow-lg hover:shadow-indigo-200 transition-all gap-2"
            >
              {isSubscribing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Please wait...
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4 text-amber-300" />
                  {isDemo ? "Try " : "Upgrade to "}
                  {plan.name} (₹{price.toLocaleString("en-IN")}){isDemo ? " in demo mode" : ""}
                </>
              )}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
