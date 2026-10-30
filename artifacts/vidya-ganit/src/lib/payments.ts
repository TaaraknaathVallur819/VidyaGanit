import { launchRazorpayCheckout, type CheckoutParams, type RazorpaySuccessResponse } from "@/lib/razorpay";
import { openDemoCheckout } from "@/lib/demoCheckout";
import { refreshPlanStatus } from "@/lib/planStatus";

// One place for the whole "create -> pay -> confirm" journey, used by the public
// pricing page, the dashboard plan card and the parent fee page, so a fix or a
// change can never be applied to one button and missed on another.

export interface PaymentOutcome {
  status: "paid" | "cancelled";
  receipt?: string;
}

async function postJson<T = Record<string, unknown>>(path: string, body: object = {}): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || `Request failed (${res.status}).`);
  return data as T;
}

/** Open Razorpay and resolve once the person has paid and the server has confirmed it. */
function runLiveCheckout(
  params: Pick<CheckoutParams, "keyId" | "amountPaise" | "orderId" | "subscriptionId" | "description" | "prefill">,
  confirm: (response: RazorpaySuccessResponse) => Promise<void>,
): Promise<PaymentOutcome> {
  return new Promise((resolve, reject) => {
    launchRazorpayCheckout({
      ...params,
      onSuccess: async (response) => {
        try {
          await confirm(response);
          resolve({ status: "paid" });
        } catch (err) {
          reject(err);
        }
      },
      onDismiss: () => resolve({ status: "cancelled" }),
      onError: (err) => reject(err),
    }).catch(reject);
  });
}

interface CreatedSubscription {
  mode: string;
  keyId: string;
  subscriptionId: string;
  amount: number;
  description: string;
}

export async function subscribeToPlan(args: {
  vidyaId: string;
  planCode: "family_plus" | "tutor_pro";
  billingCycle: "monthly" | "yearly";
  userName?: string;
}): Promise<PaymentOutcome> {
  const { vidyaId, planCode, billingCycle, userName } = args;
  const created = await postJson<CreatedSubscription>(`/api/payments/${vidyaId}/subscriptions`, {
    planCode,
    billingCycle,
  });

  let outcome: PaymentOutcome;
  if (created.mode === "demo") {
    const paid = await openDemoCheckout({
      description: created.description,
      amountPaise: created.amount,
      isPlan: true,
    });
    if (!paid) return { status: "cancelled" };
    await postJson(`/api/payments/${vidyaId}/subscriptions/demo-confirm`, {
      subscriptionId: created.subscriptionId,
    });
    outcome = { status: "paid" };
  } else {
    outcome = await runLiveCheckout(
      {
        keyId: created.keyId,
        amountPaise: created.amount,
        subscriptionId: created.subscriptionId,
        description: created.description,
        prefill: { name: userName },
      },
      async (response) => {
        await postJson(`/api/payments/${vidyaId}/subscriptions/verify`, {
          razorpay_payment_id: response.razorpay_payment_id,
          razorpay_subscription_id: response.razorpay_subscription_id || created.subscriptionId,
          razorpay_signature: response.razorpay_signature,
        });
      },
    );
  }

  if (outcome.status === "paid") refreshPlanStatus();
  return outcome;
}

interface CreatedOrder {
  mode?: string;
  keyId: string;
  orderId: string;
  amount: number;
  receipt: string;
  description?: string;
}

export async function payTuitionFee(args: {
  vidyaId: string;
  feeId: number;
  payerName?: string;
}): Promise<PaymentOutcome> {
  const { vidyaId, feeId, payerName } = args;
  const order = await postJson<CreatedOrder>(`/api/payments/${vidyaId}/parent-fees/${feeId}/order`);
  const description = order.description || `VidyaGanit tuition fee #${feeId}`;
  const reportFailure = (message: string) =>
    void fetch(`/api/payments/${vidyaId}/orders/${order.orderId}/fail`, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: message }),
    });

  try {
    if (order.mode === "demo") {
      const paid = await openDemoCheckout({ description, amountPaise: order.amount });
      if (!paid) return { status: "cancelled" };
      await postJson(`/api/payments/${vidyaId}/orders/${order.orderId}/demo-confirm`);
      return { status: "paid", receipt: order.receipt };
    }
    const outcome = await runLiveCheckout(
      {
        keyId: order.keyId,
        amountPaise: order.amount,
        orderId: order.orderId,
        description,
        prefill: { name: payerName || "Parent" },
      },
      async (response) => {
        await postJson(`/api/payments/${vidyaId}/orders/${order.orderId}/verify`, {
          razorpay_payment_id: response.razorpay_payment_id,
          razorpay_signature: response.razorpay_signature,
        });
      },
    );
    return { ...outcome, receipt: order.receipt };
  } catch (err) {
    reportFailure(err instanceof Error ? err.message : "Payment failed");
    throw err;
  }
}
