import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  IndianRupee,
  Loader2,
  CheckCircle2,
  AlertCircle,
  CreditCard,
  History,
  ShieldCheck,
  ArrowRight,
} from "lucide-react";
import { launchRazorpayCheckout } from "@/lib/razorpay";
import { useLanguage } from "@/lib/i18n";

export interface ParentFeeItem {
  id: number;
  tutorVidyaId: string;
  studentVidyaId: string;
  studentName?: string;
  amount: number; // in INR rupees
  period: string;
  note?: string | null;
  status: string;
  tutorName?: string;
  onlinePaymentAvailable: boolean;
  currency: string;
  breakdown?: {
    amountPaise: number;
    platformFeePaise: number;
    gstPaise: number;
    totalFeePaise: number;
    transferAmountPaise: number;
  };
}

export default function ParentFees({
  vidyaId,
  parentName,
}: {
  vidyaId: string;
  parentName?: string;
}) {
  const { t } = useLanguage();
  const [fees, setFees] = useState<ParentFeeItem[]>([]);
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [payingFeeId, setPayingFeeId] = useState<number | null>(null);
  const [paymentSuccessMessage, setPaymentSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchFeesAndStatus = async () => {
    try {
      setIsLoading(true);
      const [feesRes, statusRes] = await Promise.all([
        fetch(`/api/payments/${vidyaId}/parent-fees`),
        fetch(`/api/payments/${vidyaId}/status`),
      ]);

      if (feesRes.ok) {
        const feesData = await feesRes.json();
        setFees(feesData.fees || []);
      }
      if (statusRes.ok) {
        const statusData = await statusRes.json();
        setRecentOrders(statusData.recentOrders || []);
      }
    } catch (err: unknown) {
      console.error("Failed to load parent fees:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (vidyaId) {
      void fetchFeesAndStatus();
    }
  }, [vidyaId]);

  const handlePayFee = async (fee: ParentFeeItem) => {
    setPayingFeeId(fee.id);
    setErrorMessage(null);
    setPaymentSuccessMessage(null);

    try {
      // 1. Create Razorpay order on backend
      const orderRes = await fetch(`/api/payments/${vidyaId}/parent-fees/${fee.id}/order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!orderRes.ok) {
        const errData = await orderRes.json();
        throw new Error(errData.error || "Failed to initialize payment order.");
      }

      const orderData = await orderRes.json();

      // 2. Launch Razorpay Checkout overlay in INR
      await launchRazorpayCheckout({
        keyId: orderData.keyId,
        amountPaise: orderData.amount, // Paise integer
        orderId: orderData.orderId,
        description: orderData.description || `VidyaGanit tuition fee #${fee.id}`,
        prefill: {
          name: parentName || "Parent",
        },
        onSuccess: async (response) => {
          // 3. Verify payment signature on backend
          const verifyRes = await fetch(
            `/api/payments/${vidyaId}/orders/${orderData.orderId}/verify`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              }),
            },
          );

          if (!verifyRes.ok) {
            const verifyErr = await verifyRes.json();
            throw new Error(verifyErr.error || "Payment verification failed.");
          }

          setPaymentSuccessMessage(
            `Payment of ₹${fee.amount} completed successfully! Receipt: ${orderData.receipt}`,
          );
          // Refresh fee list
          await fetchFeesAndStatus();
        },
        onError: (err) => {
          setErrorMessage(err.message || "Payment process could not be completed.");
          // Inform backend of failure state
          void fetch(`/api/payments/${vidyaId}/orders/${orderData.orderId}/fail`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ error: err.message }),
          });
        },
        onDismiss: () => {
          setPayingFeeId(null);
        },
      });
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Payment error");
    } finally {
      setPayingFeeId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-indigo-500 to-violet-600 rounded-3xl p-6 text-white shadow-lg relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 text-white text-xs font-bold mb-2 backdrop-blur-sm">
              <ShieldCheck className="w-3.5 h-3.5" />
              Razorpay India &bull; Hardcoded INR Gateway
            </div>
            <h2 className="text-2xl font-black">Tuition Fee Payments</h2>
            <p className="text-indigo-100 text-sm mt-1 max-w-xl">
              Pay math tuition fees directly to your verified tutors with instant receipts and 256-bit encryption.
            </p>
          </div>
          <Badge className="bg-white text-indigo-700 font-bold px-4 py-1.5 text-sm rounded-full shadow-sm">
            Currency: INR (₹)
          </Badge>
        </div>
      </div>

      {paymentSuccessMessage && (
        <div className="bg-emerald-50 border-2 border-emerald-200 text-emerald-800 p-4 rounded-2xl flex items-center gap-3">
          <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
          <div className="text-sm font-semibold">{paymentSuccessMessage}</div>
        </div>
      )}

      {errorMessage && (
        <div className="bg-red-50 border-2 border-red-200 text-red-800 p-4 rounded-2xl flex items-center gap-3">
          <AlertCircle className="w-6 h-6 text-red-600 shrink-0" />
          <div className="text-sm font-semibold">{errorMessage}</div>
        </div>
      )}

      {/* Due Fees List */}
      <Card className="rounded-3xl border-2 border-slate-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-indigo-600" />
            <h3 className="font-bold text-slate-800">Pending Tuition Fees</h3>
          </div>
          <Badge variant="secondary" className="font-bold">
            {fees.length} Pending
          </Badge>
        </div>
        <CardContent className="p-6">
          {isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
              <p className="text-sm font-medium">Checking tuition records...</p>
            </div>
          ) : fees.length === 0 ? (
            <div className="py-12 text-center text-slate-500">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-2 opacity-80" />
              <p className="font-bold text-slate-700">All tuition fees are paid up to date!</p>
              <p className="text-xs text-slate-400 mt-1">
                New tuition fee entries recorded by your tutors will appear here for online payment.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {fees.map((fee) => {
                const isPaying = payingFeeId === fee.id;
                const b = fee.breakdown;

                return (
                  <div
                    key={fee.id}
                    data-testid={`card-fee-${fee.id}`}
                    className="rounded-2xl border-2 border-slate-100 bg-white p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:border-indigo-100 transition-colors"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-black text-slate-800 text-lg">
                          ₹{fee.amount.toLocaleString("en-IN")}
                        </span>
                        <Badge variant="outline" className="text-xs font-semibold uppercase bg-amber-50 text-amber-700 border-amber-200">
                          {fee.status}
                        </Badge>
                        <Badge variant="outline" className="text-xs font-semibold bg-indigo-50 text-indigo-700 border-indigo-200">
                          {fee.period}
                        </Badge>
                      </div>

                      <div className="text-xs text-slate-600 flex items-center gap-3">
                        <span>Student: <strong className="text-slate-800">{fee.studentName}</strong></span>
                        <span>&bull;</span>
                        <span>Tutor: <strong className="text-slate-800">{fee.tutorName}</strong></span>
                      </div>

                      {fee.note && (
                        <p className="text-xs text-slate-400 italic">
                          "{fee.note}"
                        </p>
                      )}

                      {/* Processing Breakdown Notice */}
                      {b && (
                        <div className="text-[11px] text-slate-400 flex items-center gap-2 pt-1">
                          <span>Base: ₹{fee.amount}</span>
                          <span>&bull;</span>
                          <span>Infra Fee (2% + 18% GST): ₹{(b.totalFeePaise / 100).toFixed(2)}</span>
                          <span>&bull;</span>
                          <span className="text-indigo-600 font-medium">Net to Tutor: ₹{(b.transferAmountPaise / 100).toFixed(2)}</span>
                        </div>
                      )}
                    </div>

                    <div className="w-full md:w-auto">
                      {fee.onlinePaymentAvailable ? (
                        <Button
                          onClick={() => handlePayFee(fee)}
                          disabled={isPaying}
                          data-testid={`button-pay-fee-${fee.id}`}
                          className="w-full md:w-auto rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold shadow-md gap-2"
                        >
                          {isPaying ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Launching Razorpay...
                            </>
                          ) : (
                            <>
                              <CreditCard className="w-4 h-4" />
                              Pay ₹{fee.amount} via Razorpay
                            </>
                          )}
                        </Button>
                      ) : (
                        <Badge variant="outline" className="bg-slate-50 text-slate-500 border-slate-200 p-2 text-xs">
                          Tutor hasn't enabled online payment
                        </Badge>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Transaction History */}
      {recentOrders.length > 0 && (
        <Card className="rounded-3xl border-2 border-slate-100 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <History className="w-5 h-5 text-slate-500" />
              <h3 className="font-bold text-slate-800">Recent Online Transactions</h3>
            </div>
          </div>
          <CardContent className="p-0">
            <div className="divide-y divide-slate-100">
              {recentOrders.map((order) => {
                const amount = (order.amountPaise / 100).toFixed(2);
                const isSuccess = order.status === "Success" || order.status === "paid";
                const isPending = order.status === "Pending" || order.status === "created";

                return (
                  <div key={order.id} className="p-4 flex items-center justify-between text-sm">
                    <div className="space-y-0.5">
                      <div className="font-semibold text-slate-800 flex items-center gap-2">
                        <span>₹{amount}</span>
                        <span className="text-xs text-slate-400 font-mono font-normal">
                          {order.orderId}
                        </span>
                      </div>
                      <div className="text-xs text-slate-400">
                        {order.paidAt ? new Date(order.paidAt).toLocaleString("en-IN") : new Date(order.createdAt).toLocaleString("en-IN")}
                      </div>
                    </div>
                    <div>
                      <Badge
                        variant="outline"
                        className={`text-xs font-bold ${
                          isSuccess
                            ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                            : isPending
                            ? "bg-amber-50 text-amber-700 border-amber-300"
                            : "bg-red-50 text-red-700 border-red-300"
                        }`}
                      >
                        {order.status}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
