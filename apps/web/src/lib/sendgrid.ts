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
  mode: "sendgrid" | "logged";
  messageId: string | null;
  error?: string;
};

export async function sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
  const ready = init();
  const from = process.env.SENDGRID_FROM_EMAIL ?? "booking@gigify.io";

  if (!ready) {
    console.log(`[sendgrid:stub] would send to=${params.to} subject="${params.subject}"`);
    return { delivered: false, mode: "logged", messageId: null };
  }

  // Append the CAN-SPAM footer when footer inputs are provided.
  const footer = params.footer ? buildFooter(params.footer) : null;
  const finalText = params.text + (footer ? footer.text : "");
  const baseHtml = params.html ?? params.text.replace(/\n/g, "<br/>");
  const finalHtml = baseHtml + (footer ? footer.html : "");

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
