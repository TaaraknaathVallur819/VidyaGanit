// The demo checkout is a small dialog (components/DemoCheckoutDialog.tsx) that is
// only ever opened when the server reports payments are in demo mode. No real
// payment happens: the caller finishes by calling the server's demo-confirm
// endpoint, which itself refuses unless the server is in demo mode.

export interface DemoCheckoutRequest {
  description: string;
  amountPaise: number;
  /** True for a plan purchase, so the dialog can say how long the plan lasts. */
  isPlan?: boolean;
}

export interface DemoCheckoutEventDetail extends DemoCheckoutRequest {
  resolve: (paid: boolean) => void;
}

export const DEMO_CHECKOUT_EVENT = "vg:demo-checkout";

/** Resolves true if the person pressed "Pay (demo)", false if they cancelled. */
export function openDemoCheckout(request: DemoCheckoutRequest): Promise<boolean> {
  return new Promise((resolve) => {
    window.dispatchEvent(
      new CustomEvent<DemoCheckoutEventDetail>(DEMO_CHECKOUT_EVENT, {
        detail: { ...request, resolve },
      }),
    );
  });
}
