import sgMail from "@sendgrid/mail";

let _initialized = false;
function init() {
  const key = process.env.SENDGRID_API_KEY;
  if (!key) return false;
  if (!_initialized) {
    sgMail.setApiKey(key);
    _initialized = true;
  }
  return true;
}

export type SendEmailParams = {
  to: string;
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
  attachments?: Array<{
    content: string; // base64
    filename: string;
    type: string;
    disposition: "attachment" | "inline";
  }>;
  // CAN-SPAM footer inputs. When provided, a compliant footer (sender mailing
  // address + working unsubscribe link) is appended to every email.
  footer?: {
    artistName: string;
    mailingAddress: string | null;
    unsubscribeVenueId: string;
  };
};

// Builds the legally-required footer. CAN-SPAM mandates: a valid physical
// postal address + a clear, working opt-out mechanism.
function buildFooter(f: NonNullable<SendEmailParams["footer"]>): { text: string; html: string } {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const unsubUrl = `${appUrl}/unsubscribe?v=${f.unsubscribeVenueId}`;
  const addr = f.mailingAddress?.trim() || "Address available on request";

  const text = [
    "",
    "—",
    `${f.artistName}`,
    addr,
    `Unsubscribe: ${unsubUrl}`,
  ].join("\n");

  const html = `<br/><br/><hr style="border:none;border-top:1px solid #e9e9e7;margin:16px 0"/>` +
    `<div style="font-size:12px;color:#9b9b98;line-height:1.5">` +
    `${f.artistName}<br/>${addr}<br/>` +
    `<a href="${unsubUrl}" style="color:#9b9b98">Unsubscribe from these emails</a>` +
    `</div>`;

  return { text, html };
}

export type SendEmailResult = {
  delivered: boolean;
  mode: "resend" | "sendgrid" | "logged";
  messageId: string | null;
  error?: string;
  failedOver?: boolean; // true when Resend failed and SendGrid delivered the retry
};

// The single send entry point used everywhere in the app. Provider order:
//   1. Resend  — preferred (modern API, set RESEND_API_KEY).
//   2. SendGrid — fallback (set SENDGRID_API_KEY, no Resend key).
//   3. Stub    — neither key set: log only, never throws. Lets the app run
//                end-to-end in dev without sending real mail.
// The from address resolves from EMAIL_FROM (provider-agnostic), then the
// provider-specific var, then a safe default.
export async function sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
  // Build shared content (CAN-SPAM footer + html fallback) once.
  const footer = params.footer ? buildFooter(params.footer) : null;
  const finalText = params.text + (footer ? footer.text : "");
  const baseHtml = params.html ?? params.text.replace(/\n/g, "<br/>");
  const finalHtml = baseHtml + (footer ? footer.html : "");

  // ── 1. Resend (preferred), with auto-failover to SendGrid ──
  if (process.env.RESEND_API_KEY) {
    const primary = await sendViaResend(params, finalText, finalHtml);
    if (primary.delivered) return primary;

    // Resend failed (domain issue, outage, rate limit...). If SendGrid is
    // configured, retry the same email through it so a single provider hiccup
    // doesn't drop the message. Otherwise return the original failure.
    if (init()) {
      console.warn(`[email] Resend failed (${primary.error ?? "unknown"}) — failing over to SendGrid`);
      const fallback = await sendViaSendgrid(params, finalText, finalHtml);
      if (fallback.delivered) return { ...fallback, failedOver: true };
      // Both failed — surface both errors.
      return {
        ...fallback,
        failedOver: true,
        error: `resend: ${primary.error ?? "failed"}; sendgrid: ${fallback.error ?? "failed"}`,
      };
    }
    return primary;
  }

  // ── 2. SendGrid only (no Resend key) ──
  if (init()) {
    return sendViaSendgrid(params, finalText, finalHtml);
  }

  // ── 3. Stub ──
  console.log(`[email:stub] would send to=${params.to} subject="${params.subject}"`);
  return { delivered: false, mode: "logged", messageId: null };
}

function resolveFrom(providerVar: string | undefined): string {
  return process.env.EMAIL_FROM ?? providerVar ?? "booking@gigify.io";
}

async function sendViaResend(
  params: SendEmailParams,
  finalText: string,
  finalHtml: string
): Promise<SendEmailResult> {
  const from = resolveFrom(process.env.RESEND_FROM_EMAIL);
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: params.to,
        subject: params.subject,
        text: finalText,
        html: finalHtml,
        ...(params.replyTo ? { reply_to: params.replyTo } : {}),
        ...(params.attachments
          ? {
              attachments: params.attachments.map((a) => ({
                filename: a.filename,
                content: a.content, // base64 string
              })),
            }
          : {}),
      }),
    });

    const data = (await res.json().catch(() => ({}))) as { id?: string; message?: string; name?: string };
    if (!res.ok) {
      const msg = data.message ?? data.name ?? `HTTP ${res.status}`;
      console.error("[resend] send failed:", msg);
      return { delivered: false, mode: "resend", messageId: null, error: msg };
    }
    return { delivered: true, mode: "resend", messageId: data.id ?? null };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "send failed";
    console.error("[resend] send failed:", msg);
    return { delivered: false, mode: "resend", messageId: null, error: msg };
  }
}

async function sendViaSendgrid(
  params: SendEmailParams,
  finalText: string,
  finalHtml: string
): Promise<SendEmailResult> {
  const from = resolveFrom(process.env.SENDGRID_FROM_EMAIL);
  try {
    const [response] = await sgMail.send({
      to: params.to,
      from,
      subject: params.subject,
      text: finalText,
      html: finalHtml,
      replyTo: params.replyTo,
      attachments: params.attachments,
      trackingSettings: {
        clickTracking: { enable: true, enableText: false },
        openTracking: { enable: true },
      },
    });
    const messageId = response.headers["x-message-id"] ?? null;
    return { delivered: true, mode: "sendgrid", messageId };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "send failed";
    console.error("[sendgrid] send failed:", msg);
    return { delivered: false, mode: "sendgrid", messageId: null, error: msg };
  }
}
