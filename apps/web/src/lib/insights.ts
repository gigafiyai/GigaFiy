import Anthropic from "@anthropic-ai/sdk";

const MODEL = "claude-sonnet-4-5";

export type InsightCard = {
  signal: string;
  stat: string | null;
  action: string;
  impact: "high" | "medium" | "low";
};

export type InsightContext = {
  artistName: string;
  pipelineCounts: Record<string, number>;
  totalVenues: number;
  emailMetrics: {
    sent: number;
    opened: number;
    clicked: number;
    replied: number;
  };
  conversionRates: {
    queuedToEmailed: number;
    emailedToInterested: number;
    interestedToBooked: number;
  };
  subjectVariants: Array<{
    subject: string;
    sent: number;
    opened: number;
    openRate: number;
  }>;
  survey1Responses: Array<{
    q1: string | null;
    q2: string | null;
    q3: string | null;
    q4: string | null;
  }>;
  survey2Responses: Array<{
    q1: string | null;
    q2: string | null;
    q3: string | null;
    q4: string | null;
    q5: string | null;
  }>;
  bookedVenueTypes: Record<string, number>;
};

const SYSTEM_PROMPT = `You are an analyst inside Gigify, an AI booking agent for independent musicians. Given pipeline metrics and survey responses for one artist, output 3-6 sharp, specific insight cards that the operator should act on.

Rules:
- Be concrete. Use real numbers from the data. Never invent stats.
- Each card has exactly four fields: signal, stat, action, impact.
- "impact" is "high", "medium", or "low" — high = changes close rate >5pp, medium = >2pp, low = directional.
- Actions are short, imperative, and immediately doable ("Switch subject variant A to lead with mileage").
- If the dataset is thin (<10 events), say so honestly in one of the cards and suggest what to measure next.
- Cover: subject line performance, venue-type fit, survey themes, conversion bottlenecks, 24h-cancel signal.
- Skip any card whose action is generic ("send more emails"). Only ship cards that suggest a specific change.

Return strictly JSON: { "insights": [{ "signal": "...", "stat": "...", "action": "...", "impact": "high" }] }`;

function buildUserPrompt(ctx: InsightContext): string {
  return JSON.stringify(
    {
      artist: ctx.artistName,
      pipeline: ctx.pipelineCounts,
      totalVenues: ctx.totalVenues,
      emails: ctx.emailMetrics,
      conversion: ctx.conversionRates,
      subjectVariants: ctx.subjectVariants,
      survey1: ctx.survey1Responses,
      survey2: ctx.survey2Responses,
      bookedVenueTypes: ctx.bookedVenueTypes,
    },
    null,
    2
  );
}

function templateFallback(ctx: InsightContext): InsightCard[] {
  const total = ctx.totalVenues;
  const sent = ctx.emailMetrics.sent;
  const cards: InsightCard[] = [];

  if (total < 10) {
    cards.push({
      signal: "Dataset is too thin for meaningful patterns",
      stat: `${total} venue${total === 1 ? "" : "s"} in the pipeline, ${sent} email${sent === 1 ? "" : "s"} sent`,
      action: "Run discovery on 3+ shows and send the first 25 emails before regenerating insights",
      impact: "low",
    });
    return cards;
  }

  if (ctx.emailMetrics.opened > 0 && sent > 0) {
    const rate = Math.round((ctx.emailMetrics.opened / sent) * 100);
    cards.push({
      signal: "Email open rate baseline",
      stat: `${rate}% open rate across ${sent} emails`,
      action: rate < 30
        ? "Test new subject variants — current line is underperforming the 40% indie-folk benchmark"
        : "Hold the current subject pattern and scale send volume",
      impact: rate < 30 ? "high" : "medium",
    });
  }

  if (ctx.pipelineCounts.BOOKED > 0) {
    cards.push({
      signal: "Booked-venue type distribution",
      stat: Object.entries(ctx.bookedVenueTypes)
        .map(([t, n]) => `${t.toLowerCase()}: ${n}`)
        .join(", "),
      action: "Allocate next discovery batch to whichever type leads — that's your fit",
      impact: "medium",
    });
  }

  return cards;
}

export async function generateInsights(ctx: InsightContext): Promise<{
  cards: InsightCard[];
  source: "claude" | "template";
}> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { cards: templateFallback(ctx), source: "template" };

  try {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 1500,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildUserPrompt(ctx) }],
    });
    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("No JSON in Claude response");
    const parsed = JSON.parse(match[0]) as { insights?: InsightCard[] };
    if (!Array.isArray(parsed.insights)) throw new Error("insights array missing");
    return { cards: parsed.insights, source: "claude" };
  } catch (e) {
    console.error("[insights] Claude failed, using template:", e);
    return { cards: templateFallback(ctx), source: "template" };
  }
}
