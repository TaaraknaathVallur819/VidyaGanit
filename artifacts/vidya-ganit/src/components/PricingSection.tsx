import { useState } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth";
import { launchRazorpayCheckout } from "@/lib/razorpay";
import {
  Sparkles,
  CheckCircle2,
  Crown,
  ShieldCheck,
  Zap,
  ArrowRight,
  Wallet,
  Building2,
  CreditCard,
  Lock,
  Loader2,
} from "lucide-react";

export default function PricingSection() {
  const { user } = useAuth();
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

  const handleDirectSubscribe = async (planCode: "family_plus" | "tutor_pro") => {
    if (!user) return;
    try {
      setLoadingPlan(planCode);
      const res = await fetch(`/api/payments/${user.vidyaId}/subscriptions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planCode, billingCycle }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Subscription creation failed.");
      }
      const data = await res.json();
      await launchRazorpayCheckout({
        keyId: data.keyId,
        amountPaise: data.amount,
        subscriptionId: data.subscriptionId,
        description: data.description,
        customerName: user.name,
        currency: "INR",
        notes: {
          planCode,
          billingCycle,
          role: user.role,
        },
      });
    } catch (err: any) {
      console.error("Direct subscription error:", err);
      alert(err.message || "Failed to initiate payment. Please try again.");
    } finally {
      setLoadingPlan(null);
    }
  };

  const familyPrice = billingCycle === "monthly" ? 249 : 2490;
  const tutorPrice = billingCycle === "monthly" ? 599 : 5990;

  return (
    <section
      id="pricing"
      className="relative z-10 w-full max-w-6xl mx-auto px-6 py-20 flex flex-col items-center"
      data-testid="section-pricing"
    >
      {/* Section Header */}
      <div className="text-center max-w-3xl mx-auto mb-12">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs md:text-sm font-bold mb-4 shadow-sm">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>Razorpay India Verified • Hardcoded INR (₹)</span>
        </div>
        <h2 className="text-4xl md:text-5xl font-black text-slate-800 tracking-tight leading-tight">
          Simple, Transparent <span className="text-indigo-600">Pricing</span>
        </h2>
        <p className="text-lg md:text-xl text-slate-600 mt-4 leading-relaxed font-medium">
          Whether you are a parent supporting your child or an educator running tutoring batches,
          choose the plan built for mastery.
        </p>

        {/* Monthly / Yearly Billing Toggle */}
        <div className="mt-8 inline-flex items-center bg-slate-100 p-1.5 rounded-2xl border border-slate-200 shadow-inner">
          <button
            type="button"
            onClick={() => setBillingCycle("monthly")}
            className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${
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
            className={`flex items-center gap-1.5 px-6 py-2 rounded-xl text-sm font-bold transition-all ${
              billingCycle === "yearly"
                ? "bg-white text-indigo-700 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <span>Yearly</span>
            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
              Save 17%
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
              For Families
            </Badge>
          </div>

          <h3 className="text-2xl font-black text-slate-800">Family Plus</h3>
          <p className="text-slate-600 text-sm mt-1 mb-6 font-medium">
            Personalized math mastery &amp; weekly AI diagnostics for all your children.
          </p>

          <div className="flex items-baseline gap-1 mb-2">
            <span className="text-4xl md:text-5xl font-black text-slate-900">₹{familyPrice}</span>
            <span className="text-slate-500 font-semibold text-sm">
              /{billingCycle === "monthly" ? "month" : "year"}
            </span>
          </div>
          <p className="text-xs text-slate-500 font-medium mb-8">
            Inclusive of 2% platform infrastructure fee + 18% GST (total 2.36%).
          </p>

          <ul className="space-y-3.5 flex-1 mb-8">
            {[
              "Unlimited access to all NCERT math games & missions",
              "Link up to 4 children accounts under one family",
              "Socratic AI homework assistant with step-by-step hints",
              "Weekly parent progress digests & printable report cards",
              "Pay monthly tuition directly to linked tutors via Razorpay",
            ].map((feature, i) => (
              <li key={i} className="flex items-start gap-3 text-sm text-slate-700 font-medium">
                <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                <span>{feature}</span>
              </li>
            ))}
          </ul>

          {user?.role === "parent" ? (
            <Button
              onClick={() => handleDirectSubscribe("family_plus")}
              disabled={loadingPlan === "family_plus"}
              className="w-full rounded-2xl h-14 text-base font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-[0_4px_0_0_rgba(79,70,229,0.5)] transition-all"
            >
              {loadingPlan === "family_plus" ? (
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
              ) : (
                <Zap className="w-5 h-5 mr-2" />
              )}
              Subscribe via Razorpay (₹{familyPrice})
            </Button>
          ) : (
            <Link href="/auth?mode=register&role=parent" className="block w-full">
              <Button className="w-full rounded-2xl h-14 text-base font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-[0_4px_0_0_rgba(79,70,229,0.5)] transition-all">
                Get Started with Family Plus
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
          {/* Highlight Ribbon */}
          <div className="absolute -top-3.5 right-6 bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 text-xs font-black px-4 py-1 rounded-full uppercase tracking-wider shadow-md flex items-center gap-1.5">
            <Crown className="w-3.5 h-3.5 fill-current" />
            Most Popular
          </div>

          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-amber-400">
              <Crown className="w-6 h-6" />
            </div>
            <Badge variant="outline" className="text-xs font-semibold px-3 py-1 border-indigo-400/30 text-indigo-200 bg-indigo-500/10">
              For Educators
            </Badge>
          </div>

          <h3 className="text-2xl font-black text-white">Tutor Pro</h3>
          <p className="text-indigo-200 text-sm mt-1 mb-6 font-medium">
            Everything an educator needs: batch analytics, auto-grading, and direct fee payouts.
          </p>

          <div className="flex items-baseline gap-1 mb-2">
            <span className="text-4xl md:text-5xl font-black text-white">₹{tutorPrice}</span>
            <span className="text-indigo-300 font-semibold text-sm">
              /{billingCycle === "monthly" ? "month" : "year"}
            </span>
          </div>
          <p className="text-xs text-indigo-300/80 font-medium mb-8">
            Inclusive of 2% platform infrastructure fee + 18% GST (total 2.36%).
          </p>

          <ul className="space-y-3.5 flex-1 mb-8">
            {[
              "Unlimited student batches, attendance & assignment tracking",
              "Razorpay Route Payouts: receive tuition fees directly to your bank",
              "Automated AI worksheet generator customized to class weaknesses",
              "Student mastery heatmaps & WhatsApp-ready progress cards",
              "Higher AI coaching limits & dedicated educator priority support",
            ].map((feature, i) => (
              <li key={i} className="flex items-start gap-3 text-sm text-indigo-100 font-medium">
                <CheckCircle2 className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <span>{feature}</span>
              </li>
            ))}
          </ul>

          {user?.role === "tutor" ? (
            <Button
              onClick={() => handleDirectSubscribe("tutor_pro")}
              disabled={loadingPlan === "tutor_pro"}
              className="w-full rounded-2xl h-14 text-base font-bold bg-amber-400 hover:bg-amber-300 text-slate-950 shadow-[0_4px_0_0_rgba(217,119,6,0.6)] transition-all"
            >
              {loadingPlan === "tutor_pro" ? (
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
              ) : (
                <Crown className="w-5 h-5 mr-2" />
              )}
              Subscribe via Razorpay (₹{tutorPrice})
            </Button>
          ) : (
            <Link href="/auth?mode=register&role=tutor" className="block w-full">
              <Button className="w-full rounded-2xl h-14 text-base font-bold bg-amber-400 hover:bg-amber-300 text-slate-950 shadow-[0_4px_0_0_rgba(217,119,6,0.6)] transition-all">
                Get Started with Tutor Pro
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
            <h4 className="text-lg font-black text-slate-900">
              Need to pay your tutor's tuition fee?
            </h4>
            <p className="text-sm text-slate-600 mt-1 max-w-xl">
              Parents can pay tuition directly from the <strong>Parent Dashboard &rarr; Tuition Fees</strong> tab.
              All payments are processed securely via Razorpay with instant digital receipts and WhatsApp updates.
            </p>
          </div>
        </div>
        <Link href={user?.role === "parent" ? "/dashboard/parent" : "/auth?mode=login"}>
          <Button
            variant="outline"
            className="rounded-xl font-bold border-2 border-indigo-300 bg-white text-indigo-700 hover:bg-indigo-100/50 shrink-0 h-12 px-6"
          >
            Go to Fee Portal
          </Button>
        </Link>
      </div>

      {/* Security & Indian Banking Standards Footer */}
      <div className="mt-12 flex flex-wrap items-center justify-center gap-6 text-slate-500 text-xs font-semibold">
        <div className="flex items-center gap-1.5">
          <Lock className="w-4 h-4 text-emerald-600" />
          <span>256-Bit SSL Encryption</span>
        </div>
        <span>•</span>
        <div className="flex items-center gap-1.5">
          <CreditCard className="w-4 h-4 text-indigo-600" />
          <span>UPI (GPay / PhonePe / Paytm)</span>
        </div>
        <span>•</span>
        <div className="flex items-center gap-1.5">
          <Building2 className="w-4 h-4 text-indigo-600" />
          <span>RuPay, Visa, Mastercard &amp; NetBanking</span>
        </div>
        <span>•</span>
        <div className="flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>Razorpay Webhook Cryptographic Verification</span>
        </div>
      </div>
    </section>
  );
}
