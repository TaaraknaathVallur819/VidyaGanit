import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const API = "https://api.razorpay.com/v1";

function credentials() {
  const keyId = process.env.RAZORPAY_KEY_ID || "rzp_test_vidyaganit_dummy";
  const keySecret = process.env.RAZORPAY_KEY_SECRET || "dummy_razorpay_secret_vidyaganit_2026";
  return { keyId, keySecret };
}

export function razorpayKeyId() {
  return credentials().keyId;
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
  const { keyId, keySecret } = credentials();

  // If mock mode is enabled or running with dummy keys in test/sandbox
  const isMock = process.env.RAZORPAY_MOCK === "true" || keyId.startsWith("rzp_test_vidyaganit_dummy");
  if (isMock) {
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
      Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`,
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
  if (!signature) return false;
  const expected = createHmac("sha256", secret).update(payload).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function verifyCheckoutSignature(orderId: string, paymentId: string, signature: string) {
  return verifyHmac(`${orderId}|${paymentId}`, signature, credentials().keySecret);
}

export function verifySubscriptionSignature(
  paymentId: string,
  subscriptionId: string,
  signature: string,
) {
  return verifyHmac(`${paymentId}|${subscriptionId}`, signature, credentials().keySecret);
}

export function verifyWebhook(body: Buffer, signature: string) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET || credentials().keySecret;
  return verifyHmac(body.toString("utf8"), signature, secret);
}

/**
 * Helper to generate a valid checkout signature (useful for automated testing)
 */
export function generateTestCheckoutSignature(orderId: string, paymentId: string) {
  return createHmac("sha256", credentials().keySecret).update(`${orderId}|${paymentId}`).digest("hex");
}

/**
 * Helper to generate a valid webhook signature (useful for automated testing)
 */
export function generateTestWebhookSignature(body: string | Buffer) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET || credentials().keySecret;
  const payload = Buffer.isBuffer(body) ? body.toString("utf8") : body;
  return createHmac("sha256", secret).update(payload).digest("hex");
}
