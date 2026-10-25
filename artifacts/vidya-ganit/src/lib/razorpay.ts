declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => RazorpayInstance;
  }
}

export interface RazorpayOptions {
  key: string;
  amount?: number; // In paise
  currency?: "INR"; // Strictly INR
  name: string;
  description: string;
  order_id?: string;
  subscription_id?: string;
  image?: string;
  prefill?: {
    name?: string;
    email?: string;
    contact?: string;
  };
  notes?: Record<string, string>;
  theme?: {
    color?: string;
  };
  handler?: (response: RazorpaySuccessResponse) => void;
  modal?: {
    ondismiss?: () => void;
  };
}

export interface RazorpayInstance {
  open: () => void;
  on: (event: string, callback: (response: unknown) => void) => void;
}

export interface RazorpaySuccessResponse {
  razorpay_payment_id: string;
  razorpay_order_id?: string;
  razorpay_subscription_id?: string;
  razorpay_signature: string;
}

let scriptLoadingPromise: Promise<boolean> | null = null;

export function loadRazorpayScript(): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (window.Razorpay) return Promise.resolve(true);

  if (scriptLoadingPromise) return scriptLoadingPromise;

  scriptLoadingPromise = new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => {
      console.warn("Could not load external Razorpay script; fallback dialog available.");
      resolve(false);
    };
    document.body.appendChild(script);
  });

  return scriptLoadingPromise;
}

export interface CheckoutParams {
  keyId: string;
  amountPaise: number;
  orderId?: string;
  subscriptionId?: string;
  name?: string;
  description: string;
  prefill?: {
    name?: string;
    contact?: string;
  };
  onSuccess: (response: RazorpaySuccessResponse) => Promise<void> | void;
  onDismiss?: () => void;
  onError?: (err: Error) => void;
}

/**
 * Open Razorpay Checkout with strictly INR currency and paise amounts.
 */
export async function launchRazorpayCheckout(params: CheckoutParams): Promise<void> {
  const loaded = await loadRazorpayScript();

  if (loaded && window.Razorpay) {
    const options: RazorpayOptions = {
      key: params.keyId,
      amount: params.amountPaise,
      currency: "INR",
      name: params.name || "VidyaGanit",
      description: params.description,
      ...(params.orderId ? { order_id: params.orderId } : {}),
      ...(params.subscriptionId ? { subscription_id: params.subscriptionId } : {}),
      prefill: params.prefill,
      theme: {
        color: "#4f46e5",
      },
      handler: (response) => {
        void params.onSuccess(response);
      },
      modal: {
        ondismiss: () => {
          params.onDismiss?.();
        },
      },
    };

    const instance = new window.Razorpay(options);
    instance.open();
    return;
  }

  // Fallback for sandboxed or offline environments
  console.log("Launching fallback simulated Razorpay checkout overlay");
  triggerSimulatedCheckout(params);
}

function triggerSimulatedCheckout(params: CheckoutParams) {
  // Dispatches custom event for the fallback modal component to render
  const event = new CustomEvent("vidyaganit:razorpay-checkout", {
    detail: params,
  });
  window.dispatchEvent(event);
}
