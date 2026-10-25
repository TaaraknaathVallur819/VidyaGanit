import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sparkles,
  CheckCircle2,
  Crown,
  Loader2,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { launchRazorpayCheckout } from "@/lib/razorpay";

export default function SubscriptionPlanCard({
  vidyaId,
  role,
  userName,
}: {
  vidyaId: string;
  role: "parent" | "tutor";
  userName?: string;
}) {
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");
  const [currentPlan, setCurrentPlan] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const fetchStatus = async () => {
    try {
      setIsLoading(true);
      const res = await fetch(`/api/payments/${vidyaId}/status`);
      if (res.ok) {
        const data = await res.json();
        setCurrentPlan(data.plan);
      }
    } catch (err: unknown) {
      console.error("Failed to load subscription status:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (vidyaId) {
      void fetchStatus();
    }
  }, [vidyaId]);

  const planCode = role === "parent" ? "family_plus" : "tutor_pro";
  const planName = role === "parent" ? "Family Plus" : "Tutor Pro";
  const monthlyPriceRupees = role === "parent" ? 249 : 599;
  const yearlyPriceRupees = role === "parent" ? 2499 : 5999;
  const currentPriceRupees = billingCycle === "monthly" ? monthlyPriceRupees : yearlyPriceRupees;
  const amountPaise = currentPriceRupees * 100;

  const features =
    role === "parent"
      ? [
          "Socratic Strategy AI & weekly parent learning insights",
          "Personalised worksheets & printable report card PDFs",
          "Link & monitor multiple children simultaneously",
          "Highest AI coaching limits for all linked students",
        ]
      : [
          "Tutor AI Coach, class heatmap & mastery analytics",
          "Unlimited personalised worksheet generation",
          "Razorpay Route online tuition fee collection",
          "Higher student batch & attendance management limits",
        ];

  const handleSubscribe = async () => {
    setIsSubscribing(true);
    setFeedback(null);

    try {
      // 1. Create subscription order on backend
      const res = await fetch(`/api/payments/${vidyaId}/subscriptions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planCode,
          billingCycle,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Subscription creation failed.");
      }

      const data = await res.json();

      // 2. Launch Razorpay Checkout overlay in INR
      await launchRazorpayCheckout({
        keyId: data.keyId,
        amountPaise: data.amount,
        subscriptionId: data.subscriptionId,
        description: data.description,
        prefill: {
          name: userName,
        },
        onSuccess: async (response) => {
          // 3. Verify signature
          const verifyRes = await fetch(`/api/payments/${vidyaId}/subscriptions/verify`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_subscription_id: response.razorpay_subscription_id || data.subscriptionId,
              razorpay_signature: response.razorpay_signature,
            }),
          });

          if (!verifyRes.ok) {
            const err = await verifyRes.json();
            throw new Error(err.error || "Signature verification failed.");
          }

          setFeedback(`Congratulations! You are now subscribed to ${planName}.`);
          await fetchStatus();
        },
        onError: (err) => {
          setFeedback(`Payment error: ${err.message}`);
        },
      });
    } catch (err: unknown) {
      setFeedback(err instanceof Error ? err.message : "Error initiating subscription");
    } finally {
      setIsSubscribing(false);
    }
  };

  const isActive = currentPlan && currentPlan.code === planCode;

  return (
    <Card className="rounded-3xl border-2 border-indigo-100 bg-gradient-to-br from-white via-indigo-50/30 to-violet-50/20 shadow-md overflow-hidden">
      <div className="p-6 border-b border-indigo-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Crown className="w-5 h-5 text-amber-500" />
          <h3 className="font-black text-slate-800 text-lg">
            {planName} Membership
          </h3>
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
              <span className="text-3xl font-black text-slate-800">
                ₹{currentPriceRupees.toLocaleString("en-IN")}
              </span>
              <span className="text-xs text-slate-400 font-medium">
                /{billingCycle === "monthly" ? "month" : "year"} (INR)
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Hardcoded INR &bull; Includes all taxes & platform access
            </p>
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
                Save 17%
              </span>
            </button>
          </div>
        </div>

        {/* Features Checklist */}
        <div className="space-y-2.5">
          <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
            Included in {planName}:
          </h4>
          <div className="grid grid-cols-1 gap-2">
            {features.map((feature, i) => (
              <div key={i} className="flex items-start gap-2.5 text-xs text-slate-600">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <span>{feature}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Action Button */}
        <div>
          {isActive ? (
            <div className="text-center py-2 text-xs font-medium text-emerald-700 bg-emerald-50 rounded-xl border border-emerald-200">
              Your {planName} membership is active. Enjoy all premium benefits!
            </div>
          ) : (
            <Button
              onClick={handleSubscribe}
              disabled={isSubscribing || isLoading}
              data-testid={`button-upgrade-${planCode}`}
              className="w-full h-12 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm shadow-lg hover:shadow-indigo-200 transition-all gap-2"
            >
              {isSubscribing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Connecting to Razorpay...
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4 text-amber-300" />
                  Upgrade to {planName} (₹{currentPriceRupees} INR)
                </>
              )}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
