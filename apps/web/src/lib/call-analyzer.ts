// Call analysis — the data-moat layer.
// Takes a call transcript (manual notes the artist typed, OR future
// Deepgram/Twilio speech-to-text) and produces a structured read on how the
// call went: summary, sentiment, a 0-100 booking-likelihood score, A-D tier,
// and the recommended next action.
//
// Every analyzed call becomes a labeled training example: transcript + outcome.
// Over hundreds of calls this is the proprietary dataset competitors can't copy.

import Anthropic from "@anthropic-ai/sdk";

const MODEL = "claude-sonnet-4-5";

export type CallAnalysis = {
  summary: string;            // 1-2 sentence recap
  sentiment: "positive" | "neutral" | "negative";
  callScore: number;          // 0-100 likelihood the venue books
  callTier: "A" | "B" | "C" | "D";
  nextAction: string;         // concrete next step
  contactNameCaptured: string | null; // name mentioned, if any
  emailCaptured: string | null;       // email mentioned, if any
};

const SYSTEM_PROMPT = `You analyze phone-call notes/transcripts between an independent musician (or their AI agent) and a music venue about booking a gig.

Produce a structured read on how the call went. Be realistic, not optimistic — most cold calls don't lead to bookings.

Return strictly JSON:
{
  "summary": "1-2 sentence recap of what happened",
  "sentiment": "positive" | "neutral" | "negative",
  "callScore": 0-100,
  "callTier": "A" | "B" | "C" | "D",
  "nextAction": "one concrete next step",
  "contactNameCaptured": "name or null",
  "emailCaptured": "email or null"
}

Scoring guide (callScore → tier):
- 80-100 (A): explicit interest, asked about dates/rates, gave a booking contact, said "send me info" enthusiastically
- 55-79 (B): warm, open to it, no hard commitment but real interest, asked a follow-up question
- 35-54 (C): polite but noncommittal, "maybe later", "we're booked up", neutral
- 0-34 (D): hard no, not interested, doesn't do live music, hostile, or pure voicemail with no callback

Rules:
- "voicemail, left a message" with no other signal → C tier, score ~40 (they might call back)
- Extract any email or contact name explicitly stated in the notes.
- nextAction must be specific: "Email booking link to the contact they gave" not "follow up".`;

export async function analyzeCall(opts: {
  venueName: string;
  artistName: string;
  transcript: string;
  callStatus: string; // ANSWERED | VOICEMAIL | NO_ANSWER | FAILED
}): Promise<CallAnalysis> {
  const fallback: CallAnalysis = {
    summary: opts.transcript.slice(0, 160) || `Call to ${opts.venueName} — ${opts.callStatus.toLowerCase()}`,
    sentiment: "neutral",
    callScore: opts.callStatus === "ANSWERED" ? 45 : opts.callStatus === "VOICEMAIL" ? 40 : 20,
    callTier: opts.callStatus === "ANSWERED" ? "C" : "D",
    nextAction: opts.callStatus === "ANSWERED" ? "Follow up by email" : "Try calling again or email instead",
    contactNameCaptured: null,
    emailCaptured: null,
  };

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || !opts.transcript.trim()) return fallback;

  try {
    const client = new Anthropic({ apiKey });
    const userPrompt = [
      `Venue: ${opts.venueName}`,
      `Artist: ${opts.artistName}`,
      `Call status: ${opts.callStatus}`,
      ``,
      `Call notes / transcript:`,
      `"""`,
      opts.transcript.slice(0, 4000),
      `"""`,
    ].join("\n");

    const res = await client.messages.create({
      model: MODEL,
      max_tokens: 500,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    });

    const text = res.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return fallback;
    const parsed = JSON.parse(match[0]) as Partial<CallAnalysis>;

    const score = Math.max(0, Math.min(100, parsed.callScore ?? fallback.callScore));
    const tier: CallAnalysis["callTier"] =
      score >= 80 ? "A" : score >= 55 ? "B" : score >= 35 ? "C" : "D";

    return {
      summary: parsed.summary ?? fallback.summary,
      sentiment: parsed.sentiment ?? "neutral",
      callScore: score,
      callTier: tier,
      nextAction: parsed.nextAction ?? fallback.nextAction,
      contactNameCaptured: parsed.contactNameCaptured ?? null,
      emailCaptured: parsed.emailCaptured ?? null,
    };
  } catch (e) {
    console.error("[call-analyzer] failed:", e instanceof Error ? e.message : e);
    return fallback;
  }
}
