import crypto from "node:crypto";

const SECRET = process.env.SESSION_SECRET;
if (!SECRET) {
  throw new Error("SESSION_SECRET must be set to sign session tokens.");
}

export const SESSION_COOKIE = "vg_session";
export const SESSION_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

/**
 * Stateless, signed session token: `base64url(payload).base64url(hmac)` where
 * payload is `vidyaId.expiryMs`. No DB row needed — the HMAC over SESSION_SECRET
 * is what makes it unforgeable.
 */
export function signSession(vidyaId: string): string {
  const payload = `${vidyaId}.${Date.now() + SESSION_MAX_AGE_MS}`;
  const sig = crypto
    .createHmac("sha256", SECRET as string)
    .update(payload)
    .digest("base64url");
  return `${Buffer.from(payload).toString("base64url")}.${sig}`;
}

export function verifySession(token: string | undefined): string | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payloadB64, sig] = parts;

  let payload: string;
  try {
    payload = Buffer.from(payloadB64, "base64url").toString("utf8");
  } catch {
    return null;
  }

  const expected = crypto
    .createHmac("sha256", SECRET as string)
    .update(payload)
    .digest("base64url");

  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expected);
  if (
    sigBuf.length !== expectedBuf.length ||
    !crypto.timingSafeEqual(sigBuf, expectedBuf)
  ) {
    return null;
  }

  const [vidyaId, expStr] = payload.split(".");
  const exp = Number(expStr);
  if (!vidyaId || !Number.isFinite(exp) || Date.now() > exp) {
    return null;
  }
  return vidyaId;
}
