import type { Logger } from "pino";

/**
 * Pluggable password-reset delivery.
 *
 * For now there is NO real email integration wired up: when `RESEND_API_KEY`
 * is absent we simply log the reset link so the flow is fully testable in
 * development. Drop in a Resend (or any other) provider later by setting the
 * env var — the call site does not change.
 */
export async function sendPasswordResetEmail({
  to,
  link,
  log,
}: {
  to: string;
  link: string;
  log: Logger;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    // Stub mode: surface the link in the server logs instead of emailing it.
    log.info({ to, link }, "[password-reset] email delivery is stubbed — reset link logged");
    return;
  }

  const from = process.env.RESET_EMAIL_FROM ?? "VidyaGanit <onboarding@resend.dev>";
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: "Reset your VidyaGanit password",
      html: [
        "<p>Hi,</p>",
        "<p>We received a request to reset your VidyaGanit password.</p>",
        `<p><a href="${link}">Click here to choose a new password</a>.</p>`,
        "<p>This link expires in 1 hour. If you didn't request this, you can safely ignore this email.</p>",
      ].join(""),
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    log.error({ to, status: res.status, detail }, "[password-reset] Resend delivery failed");
    throw new Error("Failed to send password reset email");
  }
}
