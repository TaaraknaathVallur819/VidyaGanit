import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const API = "https://api.razorpay.com/v1";

/**
 * Thrown whenever a payment action is attempted but Razorpay has not been
 * configured. Routes translate it into a 503 so the app fails closed instead
 * of pretending to take money.
 */
export class PaymentsUnavailableError extends Error {
  readonly code = "PAYMENTS_UNAVAILABLE";
  constructor(message = "Online payments are not switched on yet. Please try again later.") {
    super(message);
    this.name = "PaymentsUnavailableError";
  }
}

// Mock mode fakes the Razorpay API for local development and tests. It is an
// explicit opt-in (RAZORPAY_MOCK=true) and can never be active in production:
// the mock secrets below are public, so anyone could mint "valid" signatures.
export function isMockMode(): boolean {
  return process.env.RAZORPAY_MOCK === "true" && process.env.NODE_ENV !== "production";
}

function realCredentials(): { keyId: string; keySecret: string } | null {
  const keyId = process.env.RAZORPAY_KEY_ID?.trim();
  const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim();
  return keyId && keySecret ? { keyId, keySecret } : null;
}

/**
 * How payments currently behave:
 * - "live": real Razorpay keys are set (rzp_test_ keys give Razorpay's own test mode).
 * - "demo": PAYMENTS_DEMO_MODE=true and no real keys. A built-in demo checkout
 *   activates a short plan with no money and no signatures. It exists so the
 *   flow can be tried end to end; it is a deliberate free pass, so leave it off
 *   outside testing. Real keys always win over it.
 * - "mock": tests and local development only (see isMockMode).
 * - "off": nothing is configured; every payment action fails closed.
 */
export type PaymentsMode = "live" | "demo" | "mock" | "off";

export function paymentsMode(): PaymentsMode {
  if (isMockMode()) return "mock";
  if (realCredentials()) return "live";
  if (process.env.PAYMENTS_DEMO_MODE === "true") return "demo";
  return "off";
}

export function isDemoMode(): boolean {
  return paymentsMode() === "demo";
}

/** How long a demo plan lasts. Short on purpose, so a forgotten demo flag expires on its own. */
export const DEMO_ACCESS_MS = 24 * 60 * 60 * 1000;

const MOCK_KEY_ID = "rzp_test_mock";
const MOCK_KEY_SECRET = "mock_key_secret_for_local_development_only";
const MOCK_WEBHOOK_SECRET = "mock_webhook_secret_for_local_development_only";

// Only live and mock modes have signing credentials. Demo mode deliberately has
// none, so no signature can ever verify in demo mode.
function credentials(): { keyId: string; keySecret: string } | null {
  if (isMockMode()) return { keyId: MOCK_KEY_ID, keySecret: MOCK_KEY_SECRET };
  return realCredentials();
}

/** True unless payments are fully off (live, demo or mock). */
export function paymentsConfigured(): boolean {
  return paymentsMode() !== "off";
}

export function razorpayKeyId(): string {
  if (isDemoMode()) return "rzp_demo";
  const creds = credentials();
  if (!creds) throw new PaymentsUnavailableError();
  return creds.keyId;
}

export interface ProcessingFeeBreakdown {
  amountPaise: number;
  platformFeePaise: number; // 2% platform infrastructure fee
  gstPaise: number;         // 18% GST on the 2% infrastructure fee
  totalFeePaise: number;    // platformFeePaise + gstPaise
  transferAmountPaise: number; // amountPaise - totalFeePaise
}

/**
 * Standard Indian processing calculation:
 * - Currency: INR
 * - Input converted cleanly to integer paise (amount * 100)
 * - 2% platform infrastructure fee
 * - 18% GST on platform infrastructure fee
 */
export function calculateIndianProcessingFees(amountRupees: number): ProcessingFeeBreakdown {
  const amountPaise = Math.round(Number(amountRupees) * 100);
  if (!Number.isFinite(amountPaise) || amountPaise <= 0) {
    throw new Error("Invalid transaction amount.");
  }
  // 2% platform infrastructure fee
  const platformFeePaise = Math.round(amountPaise * 0.02);
  // 18% GST on platform infrastructure fee
  const gstPaise = Math.round(platformFeePaise * 0.18);
  const totalFeePaise = platformFeePaise + gstPaise;
  const transferAmountPaise = amountPaise - totalFeePaise;

  return {
    amountPaise,
    platformFeePaise,
    gstPaise,
    totalFeePaise,
    transferAmountPaise,
  };
}

export async function razorpayRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const creds = credentials();
  if (!creds && !isDemoMode()) throw new PaymentsUnavailableError();

  // Demo and mock modes answer from a local fake instead of calling Razorpay.
  if (isMockMode() || isDemoMode()) {
    const method = (init.method || "GET").toUpperCase();
    const reqBody = init.body ? JSON.parse(String(init.body)) : {};

    if (path === "/orders" && method === "POST") {
      const orderId = `order_${randomBytes(8).toString("hex")}`;
      return {
        id: orderId,
        entity: "order",
        amount: reqBody.amount,
        amount_paid: 0,
        amount_due: reqBody.amount,
        currency: "INR",
        receipt: reqBody.receipt,
        status: "created",
        transfers: reqBody.transfers || [],
        notes: reqBody.notes || {},
      } as unknown as T;
    }

    if (path === "/subscriptions" && method === "POST") {
      const subId = `sub_${randomBytes(8).toString("hex")}`;
      const now = Math.floor(Date.now() / 1000);
      return {
        id: subId,
        entity: "subscription",
        plan_id: reqBody.plan_id,
        status: "created",
        current_start: now,
        current_end: now + 30 * 86400,
        notes: reqBody.notes || {},
      } as unknown as T;
    }

    if (path.startsWith("/payments/") && method === "GET") {
      const paymentId = path.split("/")[2];
      return {
        id: paymentId,
        entity: "payment",
        amount: reqBody.amount || 0,
        currency: "INR",
        status: "captured",
        order_id: reqBody.order_id || "",
        method: "upi",
        captured: true,
      } as unknown as T;
    }

    if (path.startsWith("/subscriptions/") && method === "GET") {
      const subId = path.split("/")[2];
      const now = Math.floor(Date.now() / 1000);
      return {
        id: subId,
        status: "active",
        current_start: now,
        current_end: now + 30 * 86400,
      } as unknown as T;
    }
  }

  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Basic ${Buffer.from(`${creds!.keyId}:${creds!.keySecret}`).toString("base64")}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const body = (await response.json()) as T & { error?: { description?: string } };
  if (!response.ok) {
    throw new Error(body.error?.description ?? `Razorpay request failed (${response.status}).`);
  }
  return body;
}

export function verifyHmac(payload: string, signature: string, secret: string): boolean {
  if (!signature || !secret) return false;
  const expected = createHmac("sha256", secret).update(payload).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function verifyCheckoutSignature(orderId: string, paymentId: string, signature: string) {
  const creds = credentials();
  return !!creds && verifyHmac(`${orderId}|${paymentId}`, signature, creds.keySecret);
}

export function verifySubscriptionSignature(
  paymentId: string,
  subscriptionId: string,
  signature: string,
) {
  const creds = credentials();
  return !!creds && verifyHmac(`${paymentId}|${subscriptionId}`, signature, creds.keySecret);
}

// Razorpay signs webhooks with a secret configured on the webhook itself, which
// is separate from the API key secret. There is deliberately no fallback to the
// key secret: with no webhook secret set, every webhook is rejected.
function webhookSecret(): string {
  return process.env.RAZORPAY_WEBHOOK_SECRET?.trim() || (isMockMode() ? MOCK_WEBHOOK_SECRET : "");
}

export function verifyWebhook(body: Buffer, signature: string) {
  return verifyHmac(body.toString("utf8"), signature, webhookSecret());
}

/**
 * Test helpers: mint valid signatures against the MOCK secrets. They are only
 * meaningful when RAZORPAY_MOCK=true and never validate in production.
 */
export function generateTestCheckoutSignature(orderId: string, paymentId: string) {
  return createHmac("sha256", MOCK_KEY_SECRET).update(`${orderId}|${paymentId}`).digest("hex");
}

export function generateTestSubscriptionSignature(paymentId: string, subscriptionId: string) {
  return createHmac("sha256", MOCK_KEY_SECRET).update(`${paymentId}|${subscriptionId}`).digest("hex");
}

export function generateTestWebhookSignature(body: string | Buffer) {
  const payload = Buffer.isBuffer(body) ? body.toString("utf8") : body;
  return createHmac("sha256", MOCK_WEBHOOK_SECRET).update(payload).digest("hex");
}
