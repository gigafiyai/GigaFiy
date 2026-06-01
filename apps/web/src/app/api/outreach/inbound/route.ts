import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@gigify/db";
import Anthropic from "@anthropic-ai/sdk";

export const dynamic = "force-dynamic";

// SendGrid Inbound Parse webhook.
// Configure in SendGrid: Settings → Inbound Parse → Add Host & URL
// URL: https://yourdomain.com/api/outreach/inbound
// When a venue replies to Elijah's email, SendGrid POSTs the full email here.
// Claude classifies it and advances the Pipeline accordingly.

type Classification =
  | "INTERESTED"     // wants to book, asked a question, positive response
  | "OBJECTION"      // not now, need to think, too busy — keep warm
  | "WRONG_PERSON"   // not the booker — ask who to contact
  | "OUT_OF_OFFICE"  // auto-reply — ignore
  | "DECLINED"       // hard no
  | "UNKNOWN";

async function classifyReply(emailText: string): Promise<{
  classification: Classification;
  summary: string;
  suggestedAction: string;
}> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      classification: "UNKNOWN",
      summary: "Reply received — no API key to classify",
      suggestedAction: "Read the reply manually and update the pipeline stage.",
    };
  }

  const client = new Anthropic({ apiKey });
  const res = await client.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 400,
    system: `You classify email replies to music booking outreach.
Return strictly JSON: { "classification": "...", "summary": "...", "suggestedAction": "..." }
Classifications:
- INTERESTED: positive, wants info, asks about dates/price/logistics
- OBJECTION: not right now, need to think, too busy, not sure — but not a hard no
- WRONG_PERSON: not the booker, you want someone else, try a different contact
- OUT_OF_OFFICE: automated absence reply
- DECLINED: hard no, not interested, don't do live music, remove from list
- UNKNOWN: can't determine intent
Summary: 1 sentence max.
SuggestedAction: what the artist should do next, 1 sentence.`,
    messages: [{ role: "user", content: `Email reply text:\n\n${emailText.slice(0, 2000)}` }],
  });

  const text = res.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return { classification: "UNKNOWN", summary: "Could not parse", suggestedAction: "Read manually." };
  try {
    return JSON.parse(match[0]);
  } catch {
    return { classification: "UNKNOWN", summary: "Parse error", suggestedAction: "Read manually." };
  }
}

// SendGrid sends form data (multipart). Parse the key fields.
async function parseInbound(req: NextRequest): Promise<{
  from: string;
  to: string;
  subject: string;
  text: string;
  html: string;
  messageId: string | null;
}> {
  const formData = await req.formData().catch(() => new FormData());
  return {
    from: String(formData.get("from") ?? ""),
    to: String(formData.get("to") ?? ""),
    subject: String(formData.get("subject") ?? ""),
    text: String(formData.get("text") ?? ""),
    html: String(formData.get("html") ?? ""),
    messageId: String(formData.get("headers") ?? "").match(/Message-ID:\s*<([^>]+)>/i)?.[1] ?? null,
  };
}

function extractEmailAddress(from: string): string {
  // "Sarah Chen <sarah@venue.com>" → "sarah@venue.com"
  const match = from.match(/<([^>]+)>/);
  if (match) return match[1].toLowerCase();
  return from.trim().toLowerCase();
}

export async function POST(req: NextRequest) {
  const parsed = await parseInbound(req);
  const fromEmail = extractEmailAddress(parsed.from);

  // Find the venue by matching the sender email.
  const venue = await prisma.venue.findFirst({
    where: {
      OR: [
        { decisionMakerEmail: { equals: fromEmail, mode: "insensitive" } },
        { email: { equals: fromEmail, mode: "insensitive" } },
      ],
    },
    include: { pipeline: true, artist: true },
  });

  // Even if we can't match a venue, log the inbound.
  const replyText = parsed.text || parsed.html.replace(/<[^>]+>/g, " ");

  if (!venue) {
    console.log(`[inbound] unmatched reply from ${fromEmail}: ${replyText.slice(0, 200)}`);
    return NextResponse.json({ ok: true, matched: false });
  }

  const { classification, summary, suggestedAction } = await classifyReply(replyText);

  // Stage transitions by classification.
  const stageMap: Record<Classification, string | null> = {
    INTERESTED: "INTERESTED",
    OBJECTION: null, // stay — but note it
    WRONG_PERSON: null,
    OUT_OF_OFFICE: null,
    DECLINED: "DECLINED",
    UNKNOWN: null,
  };
  const nextStage = stageMap[classification];

  if (venue.pipeline && nextStage && nextStage !== venue.pipeline.stage) {
    await prisma.pipeline.update({
      where: { id: venue.pipeline.id },
      data: { stage: nextStage as any },
    });
  }

  // Update the most recent outreach to REPLIED.
  await prisma.outreach.updateMany({
    where: {
      venueId: venue.id,
      channel: "EMAIL",
      status: { in: ["SENT", "OPENED", "CLICKED"] },
    },
    data: { status: "REPLIED" },
  });

  // Log the inbound as a note on the pipeline.
  if (venue.pipeline) {
    await prisma.pipeline.update({
      where: { id: venue.pipeline.id },
      data: {
        notes: [
          venue.pipeline.notes,
          `Reply ${new Date().toLocaleDateString()}: [${classification}] ${summary} → ${suggestedAction}`,
        ]
          .filter(Boolean)
          .join("\n"),
      },
    });
  }

  console.log(
    `[inbound] ${venue.name} (${fromEmail}) → ${classification}: ${summary}`
  );

  return NextResponse.json({
    ok: true,
    matched: true,
    venue: venue.name,
    classification,
    summary,
    suggestedAction,
    pipelineUpdated: !!nextStage,
  });
}
