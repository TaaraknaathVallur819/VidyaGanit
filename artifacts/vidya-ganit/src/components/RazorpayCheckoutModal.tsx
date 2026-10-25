import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { IndianRupee, ShieldCheck, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import type { CheckoutParams, RazorpaySuccessResponse } from "@/lib/razorpay";

export default function RazorpayCheckoutModal() {
  const [params, setParams] = useState<CheckoutParams | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState<"upi" | "card" | "netbanking">("upi");

  useEffect(() => {
    const handleEvent = (e: Event) => {
      const customEvent = e as CustomEvent<CheckoutParams>;
      if (customEvent.detail) {
        setParams(customEvent.detail);
        setIsOpen(true);
      }
    };

    window.addEventListener("vidyaganit:razorpay-checkout", handleEvent);
    return () => {
      window.removeEventListener("vidyaganit:razorpay-checkout", handleEvent);
    };
  }, []);

  if (!params) return null;

  const amountRupees = (params.amountPaise / 100).toFixed(2);
  // 2% platform infrastructure fee + 18% GST on platform fee
  const platformFeePaise = Math.round(params.amountPaise * 0.02);
  const gstPaise = Math.round(platformFeePaise * 0.18);
  const totalDeductionPaise = platformFeePaise + gstPaise;
  const netPaise = params.amountPaise - totalDeductionPaise;

  const handleCompleteDummyPayment = async () => {
    setIsProcessing(true);
    try {
      const dummyPaymentId = `pay_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      // Generate HMAC signature using the test secret if possible or standard hex
      const response: RazorpaySuccessResponse = {
        razorpay_payment_id: dummyPaymentId,
        razorpay_order_id: params.orderId,
        razorpay_subscription_id: params.subscriptionId,
        razorpay_signature: `sig_${Date.now()}_dummy_signature`,
      };

      // Call success handler
      await params.onSuccess(response);
      setIsOpen(false);
    } catch (err: unknown) {
      params.onError?.(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancel = () => {
    params.onDismiss?.();
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleCancel()}>
      <DialogContent className="max-w-md bg-white border-2 border-indigo-200 rounded-3xl p-6 shadow-2xl">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center text-white font-black text-xl shadow-md">
                ₹
              </div>
              <div>
                <DialogTitle className="text-xl font-black text-slate-800">
                  Razorpay Checkout
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500 font-medium">
                  {params.name || "VidyaGanit"} &bull; Secured with 256-bit SSL
                </DialogDescription>
              </div>
            </div>
            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300 gap-1 font-bold">
              <ShieldCheck className="w-3.5 h-3.5" />
              INR
            </Badge>
          </div>
        </DialogHeader>

        <div className="space-y-4 my-2">
          {/* Order Details Banner */}
          <div className="rounded-2xl bg-slate-50 border border-slate-200/80 p-4 space-y-2">
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-600 font-medium">{params.description}</span>
              <span className="text-xl font-black text-indigo-700">₹{amountRupees}</span>
            </div>
            {params.orderId && (
              <div className="text-xs text-slate-400 font-mono">
                Order ID: {params.orderId}
              </div>
            )}
            
            {/* Indian Processing Variables Breakdown */}
            <div className="pt-2 border-t border-slate-200 text-xs text-slate-500 space-y-1">
              <div className="flex justify-between">
                <span>Total Amount (Paise: {params.amountPaise})</span>
                <span className="font-semibold text-slate-700">₹{amountRupees}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Platform Infra Fee (2%)</span>
                <span>₹{(platformFeePaise / 100).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>GST on Platform Fee (18%)</span>
                <span>₹{(gstPaise / 100).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-indigo-600 font-medium pt-1 border-t border-slate-200/60">
                <span>Net Transfer</span>
                <span>₹{(netPaise / 100).toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Payment Method Selector */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">
              Select Payment Method (INR)
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setSelectedMethod("upi")}
                className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all text-center ${
                  selectedMethod === "upi"
                    ? "bg-indigo-50 border-indigo-500 text-indigo-700 shadow-sm"
                    : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                UPI / QR
              </button>
              <button
                type="button"
                onClick={() => setSelectedMethod("card")}
                className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all text-center ${
                  selectedMethod === "card"
                    ? "bg-indigo-50 border-indigo-500 text-indigo-700 shadow-sm"
                    : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                Debit/Credit
              </button>
              <button
                type="button"
                onClick={() => setSelectedMethod("netbanking")}
                className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all text-center ${
                  selectedMethod === "netbanking"
                    ? "bg-indigo-50 border-indigo-500 text-indigo-700 shadow-sm"
                    : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                Netbanking
              </button>
            </div>
          </div>

          {/* Prefill info */}
          {params.prefill?.name && (
            <div className="text-xs text-slate-500 bg-indigo-50/50 p-2.5 rounded-xl border border-indigo-100 flex items-center justify-between">
              <span>Payer: <strong className="text-slate-700">{params.prefill.name}</strong></span>
              {params.prefill.contact && <span>{params.prefill.contact}</span>}
            </div>
          )}
        </div>

        <DialogFooter className="flex flex-col sm:flex-row gap-2 pt-2">
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={isProcessing}
            className="w-full sm:w-auto rounded-2xl"
          >
            Cancel
          </Button>
          <Button
            onClick={handleCompleteDummyPayment}
            disabled={isProcessing}
            data-testid="button-complete-razorpay-payment"
            className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-2xl shadow-md gap-2"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Processing INR...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                Pay ₹{amountRupees} via Razorpay
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
