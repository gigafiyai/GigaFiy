// Vapi outbound-call client. Turns a Tulio brief into a live phone call.
//
// Vapi places the call from a phone number provisioned in your Vapi account
// (VAPI_PHONE_NUMBER_ID) to the venue's number, running an inline assistant
// built from our system prompt + opener. End-of-call reports (transcript,
// recording, outcome) are POSTed to our webhook so the call-analyzer can score
// them — closing the data-moat loop.
//
// Required env:
//   VAPI_API_KEY            — your Vapi private key
//   VAPI_PHONE_NUMBER_ID    — the Vapi phone number to call FROM
// Optional env (sensible defaults; tune to your Vapi account):
//   VAPI_MODEL_PROVIDER     — default "anthropic"
//   VAPI_MODEL              — default "claude-sonnet-4-5"
//   VAPI_VOICE_PROVIDER     — default "vapi"
//   VAPI_VOICE_ID           — default "Elliot"
//   VAPI_WEBHOOK_URL        — where Vapi POSTs end-of-call reports
//   VAPI_DEBUG=1            — log the raw request/response

import type { AgentBrief } from "@/lib/agent-brief";

const VAPI_CALL_ENDPOINT = "https://api.vapi.ai/call";

export type PlaceCallInput = {
  toNumber: string;       // E.164, e.g. "+16175551234"
  brief: AgentBrief;
  metadata?: Record<string, string>; // echoed back on the webhook (venueId, etc.)
};

export type PlaceCallResult =
  | { ok: true; callId: string; status: string | null }
  | { ok: false; error: string; configured: boolean };

// Normalize a US phone string to E.164. Returns null if it doesn't look valid.
export function toE164(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/[^\d]/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (raw.trim().startsWith("+")) return `+${digits}`;
  return null;
}

export function vapiConfigured(): boolean {
  return !!(process.env.VAPI_API_KEY && process.env.VAPI_PHONE_NUMBER_ID);
}

export async function placeCall(input: PlaceCallInput): Promise<PlaceCallResult> {
  const apiKey = process.env.VAPI_API_KEY;
  const phoneNumberId = process.env.VAPI_PHONE_NUMBER_ID;
  if (!apiKey || !phoneNumberId) {
    return { ok: false, error: "Vapi not configured (need VAPI_API_KEY + VAPI_PHONE_NUMBER_ID)", configured: false };
  }

  const modelProvider = process.env.VAPI_MODEL_PROVIDER ?? "anthropic";
  const model = process.env.VAPI_MODEL ?? "claude-sonnet-4-5";
  const voiceProvider = process.env.VAPI_VOICE_PROVIDER ?? "vapi";
  const voiceId = process.env.VAPI_VOICE_ID ?? "Elliot";
  const webhookUrl = process.env.VAPI_WEBHOOK_URL;

  const body = {
    phoneNumberId,
    customer: { number: input.toNumber },
    assistant: {
      firstMessage: input.brief.firstLine,
      model: {
        provider: modelProvider,
        model,
        messages: [{ role: "system", content: input.brief.systemPrompt }],
      },
      voice: { provider: voiceProvider, voiceId },
      // Leave a tailored voicemail if we hit one.
      voicemailMessage: input.brief.voicemail,
      endCallFunctionEnabled: true,
      // Where Vapi posts the end-of-call report (transcript, recording, outcome).
      ...(webhookUrl ? { server: { url: webhookUrl } } : {}),
      // Extract the terms Tulio closed on, so we can auto-send the booking link.
      analysisPlan: {
        structuredDataPlan: {
          enabled: true,
          schema: {
            type: "object",
            properties: {
              agreedToBook: {
                type: "boolean",
                description: "True only if the venue verbally agreed to book a specific date and wants the booking link.",
              },
              agreedDate: {
                type: "string",
                description: "The date the venue agreed to, normalized to YYYY-MM-DD. Empty string if none.",
              },
              agreedTime: {
                type: "string",
                description: 'The agreed start time, e.g. "7:30 PM". Empty string if none.',
              },
              agreedPrice: {
                type: "number",
                description: "The fee agreed on the call in US dollars. 0 if not agreed.",
              },
              contactEmail: {
                type: "string",
                description: "The best email the venue gave for the booking link. Empty string if none.",
              },
              contactName: {
                type: "string",
                description: "The contact person's name. Empty string if none.",
              },
              venueBookedThrough: {
                type: "string",
                description: 'How far out the venue said they are currently booked, e.g. "through August" or "2 months out". Empty string if not discussed.',
              },
            },
            required: ["agreedToBook"],
          },
        },
      },
      metadata: input.metadata ?? {},
    },
    metadata: input.metadata ?? {},
  };

  if (process.env.VAPI_DEBUG === "1") {
    console.log("[vapi] request", JSON.stringify(body).slice(0, 1500));
  }

  try {
    const res = await fetch(VAPI_CALL_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = (await res.json().catch(() => ({}))) as {
      id?: string;
      status?: string;
      message?: string | string[];
      error?: string;
    };

    if (process.env.VAPI_DEBUG === "1") {
      console.log("[vapi] response", res.status, JSON.stringify(data).slice(0, 1500));
    }

    if (!res.ok) {
      const msg = Array.isArray(data.message) ? data.message.join("; ") : data.message ?? data.error ?? `HTTP ${res.status}`;
      return { ok: false, error: msg, configured: true };
    }
    return { ok: true, callId: data.id ?? "", status: data.status ?? null };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "request failed", configured: true };
  }
}
