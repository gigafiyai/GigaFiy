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
};

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

  try {
    const [response] = await sgMail.send({
      to: params.to,
      from,
      subject: params.subject,
      text: params.text,
      html: params.html ?? params.text.replace(/\n/g, "<br/>"),
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
