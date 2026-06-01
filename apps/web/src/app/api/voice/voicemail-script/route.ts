import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@gigify/db";
import Anthropic from "@anthropic-ai/sdk";

export const dynamic = "force-dynamic";

// Generates a 30-second personal voicemail script the artist reads themselves
// when cold-calling a venue that has no email on file.
// Feels authentic because it IS authentic — it's the artist calling, not Nova.

export async function POST(req: NextRequest) {
  const { venueId } = (await req.json()) as { venueId?: string };
  if (!venueId) return NextResponse.json({ error: "venueId required" }, { status: 400 });

  const venue = await prisma.venue.findUnique({
    where: { id: venueId },
    include: { nearestShow: true, artist: true },
  });
  if (!venue) return NextResponse.json({ error: "venue not found" }, { status: 404 });

  const v = venue;
  const artist = v.artist;

  // If artist has a saved custom template, use that as the base.
  const customTemplate = artist.voicemailScript;

  const apiKey = process.env.ANTHROPIC_API_KEY;

  // Template fallback (no API key needed).
  function buildTemplate(): string {
    const showLine = v.nearestShow
      ? `I'm actually playing ${v.nearestShow.venueName} in ${v.nearestShow.city} on ${v.nearestShow.date.toLocaleDateString("en-US", { month: "long", day: "numeric" })} — just ${Math.round(v.distanceMiles ?? 0)} miles from you — so I'm routing through the area.`
      : `I'm routing through ${v.city} this summer.`;

    const decisionMaker = v.decisionMakerName
      ? `${v.decisionMakerName.split(" ")[0]}`
      : "there";

    return [
      `Hey ${decisionMaker}, this is ${artist.name}${artist.hometown ? `, calling from ${artist.hometown}` : ""}.`,
      ``,
      `${showLine}`,
      ``,
      `I'd love to play ${v.name} — simple offer: 50% deposit holds the date, and you've got 24 hours to cancel for a full refund if anything changes.`,
      ``,
      `Could you shoot me an email with the best contact for booking? I'm at ${artist.contactEmail}.`,
      `I'll send you the reel and a one-click booking link.`,
      ``,
      `Thanks — hope to hear from you.`,
    ].join("\n");
  }

  if (customTemplate) {
    // Inject the venue-specific details into the saved template.
    const showLine = v.nearestShow
      ? `${v.nearestShow.venueName} on ${v.nearestShow.date.toLocaleDateString("en-US", { month: "long", day: "numeric" })} (${Math.round(v.distanceMiles ?? 0)} mi away)`
      : `${v.city}`;

    const script = customTemplate
      .replace(/\[venue\]/gi, v.name)
      .replace(/\[city\]/gi, v.city)
      .replace(/\[show\]/gi, showLine)
      .replace(/\[email\]/gi, artist.contactEmail)
      .replace(/\[name\]/gi, v.decisionMakerName?.split(" ")[0] ?? "there");

    return NextResponse.json({ script, source: "custom_template" });
  }

  if (!apiKey) {
    return NextResponse.json({ script: buildTemplate(), source: "template" });
  }

  // Claude-written version — more natural.
  try {
    const client = new Anthropic({ apiKey });
    const prompt = [
      `Write a 30-second personal voicemail script for an independent musician calling a venue to ask for a booking contact email.`,
      ``,
      `Artist: ${artist.name}${artist.hometown ? `, based in ${artist.hometown}` : ""}`,
      `Genre: ${artist.genre}`,
      `Artist's email: ${artist.contactEmail}`,
      ``,
      `Venue: ${v.name} in ${v.city}, ${v.state}`,
      `Decision maker: ${v.decisionMakerName ?? "unknown — use a generic greeting"}`,
      v.nearestShow
        ? `Nearby confirmed show: ${v.nearestShow.venueName} on ${v.nearestShow.date.toLocaleDateString("en-US", { month: "long", day: "numeric" })}, ${Math.round(v.distanceMiles ?? 0)} miles away`
        : `No nearby show — routing generally through the area`,
      ``,
      `Rules:`,
      `- The artist is calling themselves, not an AI. First person.`,
      `- Keep it under 30 seconds when read aloud (~75 words).`,
      `- Main ask: "Could you send me an email? I'm at [artist email]" — capturing their email OR getting them to email you.`,
      `- Mention the proximity show once, casually.`,
      `- Mention the 24-hour cancel offer briefly.`,
      `- End with artist's email spelled out clearly.`,
      `- Natural, warm, not salesy. Like a real musician calling.`,
      `- No emojis, no markdown, plain text.`,
    ].join("\n");

    const response = await client.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 400,
      messages: [{ role: "user", content: prompt }],
    });

    const script = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();

    return NextResponse.json({ script, source: "claude" });
  } catch {
    return NextResponse.json({ script: buildTemplate(), source: "template" });
  }
}
