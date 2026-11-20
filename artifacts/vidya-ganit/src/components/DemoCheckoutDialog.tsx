import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FlaskConical, Loader2 } from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { DEMO_CHECKOUT_EVENT, type DemoCheckoutEventDetail } from "@/lib/demoCheckout";

/**
 * The checkout shown when the server is in demo mode. It is deliberately honest:
 * it says plainly that no money moves. Real payments never come through here;
 * they open Razorpay's own window (see lib/razorpay.ts).
 */
export default function DemoCheckoutDialog() {
  const { t } = useLanguage();
  const [request, setRequest] = useState<DemoCheckoutEventDetail | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onOpen = (e: Event) => {
      setRequest((e as CustomEvent<DemoCheckoutEventDetail>).detail);
      setBusy(false);
    };
    window.addEventListener(DEMO_CHECKOUT_EVENT, onOpen);
    return () => window.removeEventListener(DEMO_CHECKOUT_EVENT, onOpen);
  }, []);

  const close = (paid: boolean) => {
    request?.resolve(paid);
    setRequest(null);
  };

  const amount = request ? (request.amountPaise / 100).toLocaleString("en-IN") : "";

  return (
    <Dialog open={request !== null} onOpenChange={(open) => !open && !busy && close(false)}>
      <DialogContent className="max-w-md rounded-3xl" data-testid="dialog-demo-checkout">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-black">
            <FlaskConical className="h-5 w-5 text-amber-500" />
            {t("demo.title")}
          </DialogTitle>
          <DialogDescription>{request?.description}</DialogDescription>
        </DialogHeader>

        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">
          <p>{t("demo.banner")}</p>
          {request?.isPlan && <p className="mt-1">{t("demo.planNote")}</p>}
        </div>

        <p className="text-center text-3xl font-black text-slate-800">₹{amount}</p>

        <DialogFooter className="flex flex-col gap-2 sm:flex-row">
          <Button variant="outline" className="rounded-2xl" disabled={busy} onClick={() => close(false)}>
            {t("demo.cancel")}
          </Button>
          <Button
            className="rounded-2xl bg-indigo-600 font-bold text-white hover:bg-indigo-500"
            disabled={busy}
            data-testid="button-demo-pay"
            onClick={() => {
              setBusy(true);
              close(true);
            }}
          >
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t("demo.pay").replace("{amount}", amount)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
