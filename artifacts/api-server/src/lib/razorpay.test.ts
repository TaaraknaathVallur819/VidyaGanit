import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  DEMO_ACCESS_MS,
  PaymentsUnavailableError,
  generateTestWebhookSignature,
  isDemoMode,
  isMockMode,
  paymentsConfigured,
  paymentsMode,
  razorpayKeyId,
  razorpayRequest,
  verifyCheckoutSignature,
  verifySubscriptionSignature,
  verifyWebhook,
} from "./razorpay";
import { PLACEHOLDER_PLAN_IDS, providerPlanId } from "./paymentCatalog";

// The secret that older builds fell back to when no Razorpay keys were set. It is
// published in the repository, so nothing signed with it may ever be trusted.
const LEGACY_PUBLIC_SECRET = "dummy_razorpay_secret_vidyaganit_2026";
const sign = (payload: string, secret: string) =>
  createHmac("sha256", secret).update(payload).digest("hex");

const KEYS = [
  "RAZORPAY_KEY_ID",
  "RAZORPAY_KEY_SECRET",
  "RAZORPAY_WEBHOOK_SECRET",
  "RAZORPAY_MOCK",
  "RAZORPAY_PLAN_FAMILY_PLUS_MONTHLY",
  "PAYMENTS_DEMO_MODE",
  "NODE_ENV",
] as const;
const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const k of KEYS) {
    saved[k] = process.env[k];
    delete process.env[k];
  }
  process.env.NODE_ENV = "production";
});
afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

describe("gateway with no Razorpay credentials (production default)", () => {
  it("is not configured and refuses to create anything", async () => {
    expect(paymentsConfigured()).toBe(false);
    expect(() => razorpayKeyId()).toThrow(PaymentsUnavailableError);
    await expect(razorpayRequest("/orders", { method: "POST", body: "{}" })).rejects.toBeInstanceOf(
      PaymentsUnavailableError,
    );
  });

  it("rejects every signature made with the old public dummy secret", () => {
    const body = Buffer.from('{"event":"subscription.activated"}');
    expect(verifyWebhook(body, sign(body.toString(), LEGACY_PUBLIC_SECRET))).toBe(false);
    expect(
      verifyCheckoutSignature("order_1", "pay_1", sign("order_1|pay_1", LEGACY_PUBLIC_SECRET)),
    ).toBe(false);
    expect(
      verifySubscriptionSignature("pay_1", "sub_1", sign("pay_1|sub_1", LEGACY_PUBLIC_SECRET)),
    ).toBe(false);
  });

  it("rejects a webhook with an empty signature", () => {
    expect(verifyWebhook(Buffer.from("{}"), "")).toBe(false);
  });

  it("will not sell a plan that has no configured Razorpay plan id", () => {
    expect(() => providerPlanId("family_plus", "monthly")).toThrow(PaymentsUnavailableError);
  });
});

describe("mock mode is an explicit, non-production opt-in", () => {
  it("stays off in production even if RAZORPAY_MOCK=true is set", () => {
    process.env.RAZORPAY_MOCK = "true";
    process.env.NODE_ENV = "production";
    expect(isMockMode()).toBe(false);
    expect(paymentsConfigured()).toBe(false);
  });

  it("works outside production only when asked for", async () => {
    process.env.NODE_ENV = "test";
    expect(isMockMode()).toBe(false);
    process.env.RAZORPAY_MOCK = "true";
    expect(isMockMode()).toBe(true);
    expect(paymentsConfigured()).toBe(true);
    const order = await razorpayRequest<{ id: string }>("/orders", {
      method: "POST",
      body: JSON.stringify({ amount: 100 }),
    });
    expect(order.id).toMatch(/^order_/);
    const body = Buffer.from("{}");
    expect(verifyWebhook(body, generateTestWebhookSignature(body))).toBe(true);
  });

  it("falls back to placeholder plan ids in mock mode only", () => {
    process.env.NODE_ENV = "test";
    process.env.RAZORPAY_MOCK = "true";
    expect(providerPlanId("family_plus", "monthly")).toBe("plan_family_plus_monthly");
    expect(PLACEHOLDER_PLAN_IDS).toEqual(
      expect.arrayContaining([
        "plan_family_plus_monthly",
        "plan_family_plus_yearly",
        "plan_tutor_pro_monthly",
        "plan_tutor_pro_yearly",
      ]),
    );
  });
});

describe("real credentials", () => {
  beforeEach(() => {
    process.env.RAZORPAY_KEY_ID = "rzp_test_realKeyId";
    process.env.RAZORPAY_KEY_SECRET = "real_key_secret";
  });

  it("verifies checkout and subscription signatures with the key secret", () => {
    expect(paymentsConfigured()).toBe(true);
    expect(razorpayKeyId()).toBe("rzp_test_realKeyId");
    expect(
      verifyCheckoutSignature("order_1", "pay_1", sign("order_1|pay_1", "real_key_secret")),
    ).toBe(true);
    expect(
      verifySubscriptionSignature("pay_1", "sub_1", sign("pay_1|sub_1", "real_key_secret")),
    ).toBe(true);
    expect(verifyCheckoutSignature("order_1", "pay_1", sign("order_1|pay_1", "wrong"))).toBe(false);
  });

  it("does not accept webhooks until a webhook secret is configured", () => {
    const body = Buffer.from('{"event":"subscription.activated"}');
    // Signed with the API key secret, which is NOT the webhook secret.
    expect(verifyWebhook(body, sign(body.toString(), "real_key_secret"))).toBe(false);
    process.env.RAZORPAY_WEBHOOK_SECRET = "whsec_real";
    expect(verifyWebhook(body, sign(body.toString(), "whsec_real"))).toBe(true);
    expect(verifyWebhook(body, sign(body.toString(), "real_key_secret"))).toBe(false);
  });

  it("uses the configured Razorpay plan id", () => {
    process.env.RAZORPAY_PLAN_FAMILY_PLUS_MONTHLY = "plan_Abc123";
    expect(providerPlanId("family_plus", "monthly")).toBe("plan_Abc123");
  });
});

describe("payment modes", () => {
  it("is off by default: nothing configured, nothing works", () => {
    expect(paymentsMode()).toBe("off");
    expect(isDemoMode()).toBe(false);
    expect(paymentsConfigured()).toBe(false);
  });

  it("demo mode turns on only when explicitly asked for, even in production", () => {
    process.env.PAYMENTS_DEMO_MODE = "true";
    expect(paymentsMode()).toBe("demo");
    expect(paymentsConfigured()).toBe(true);
    process.env.PAYMENTS_DEMO_MODE = "yes";
    expect(paymentsMode()).toBe("off");
  });

  it("real keys always override demo mode", () => {
    process.env.PAYMENTS_DEMO_MODE = "true";
    process.env.RAZORPAY_KEY_ID = "rzp_test_realKeyId";
    process.env.RAZORPAY_KEY_SECRET = "real_key_secret";
    expect(paymentsMode()).toBe("live");
    expect(isDemoMode()).toBe(false);
    expect(razorpayKeyId()).toBe("rzp_test_realKeyId");
  });

  it("demo mode has no signing secret, so no signature can ever verify", () => {
    process.env.PAYMENTS_DEMO_MODE = "true";
    expect(verifyCheckoutSignature("order_1", "pay_1", sign("order_1|pay_1", "demo"))).toBe(false);
    expect(verifySubscriptionSignature("pay_1", "sub_1", sign("pay_1|sub_1", "demo"))).toBe(false);
    expect(verifyWebhook(Buffer.from("{}"), sign("{}", "demo"))).toBe(false);
    expect(verifyWebhook(Buffer.from("{}"), sign("{}", LEGACY_PUBLIC_SECRET))).toBe(false);
  });

  it("demo mode answers from a local fake and never calls Razorpay", async () => {
    process.env.PAYMENTS_DEMO_MODE = "true";
    expect(razorpayKeyId()).toBe("rzp_demo");
    const order = await razorpayRequest<{ id: string }>("/orders", {
      method: "POST",
      body: JSON.stringify({ amount: 100 }),
    });
    expect(order.id).toMatch(/^order_/);
  });

  it("demo plans use a recognisable plan id, even if a real plan id is configured", () => {
    process.env.PAYMENTS_DEMO_MODE = "true";
    process.env.RAZORPAY_PLAN_FAMILY_PLUS_MONTHLY = "plan_Abc123";
    expect(providerPlanId("family_plus", "monthly")).toBe("demo_family_plus_monthly");
  });

  it("a demo plan is short-lived", () => {
    expect(DEMO_ACCESS_MS).toBeLessThanOrEqual(24 * 60 * 60 * 1000);
  });
});
