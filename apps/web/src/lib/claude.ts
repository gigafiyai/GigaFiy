import Anthropic from "@anthropic-ai/sdk";

const MODEL = "claude-sonnet-4-5";

export type OutreachContext = {
  artist: {
    name: string;
    genre: string;
    bio: string;
    drawDescription: string;
    hometown: string | null;
    instagramHandle: string | null;
    videoReelUrl: string | null;
    epkUrl: string | null;
  };
  venue: {
    name: string;
    city: string;
    state: string;
    venueType: string;
    decisionMakerName: string | null;
    decisionMakerRole: string | null;
    narrative: string | null;
    cuisine: string | null;
    vibe: string[];
    hostsLiveMusic: boolean | null;
    genresHosted: string[];
    privateEventsFriendly?: boolean | null;
  };
  nearestShow: {
    venueName: string;
    city: string;
    state: string;
    date: string;
    distanceMiles: number;
  } | null;
  availableDates: { iso: string; pretty: string; timeContext?: string; sameDayShowName?: string }[];
  bookingLink: string;
};

export type GeneratedEmail = {
  subject: string;
  body: string;
  source: "claude" | "template";
  fallbackReason?: string;
};

const SYSTEM_PROMPT = `You write outbound booking emails for Gigify, an automated booking agent for independent musicians. Each email must read like the artist sat down and wrote it personally — not a template with name swaps.

Voice:
- First-person, conversational, the way a working musician actually writes. Short, direct sentences. No formal flourishes.
- Confident but not pushy. The artist knows their value but isn't selling.
- If you wouldn't say it out loud at a bar, don't write it.

Hard rules — NEVER violate:
- The offer is ALWAYS framed as a mutual commitment: "half deposit holds the date for both of us — full refund in 24 hours if anything changes." This is NOT a risk-reduction pitch. It's a commitment from the artist too. Both parties have skin in the game. Never say "no risk for you" or "risk-free."
- If a nearby confirmed show is provided, mention it ONCE as a casual proof-of-routing — never as an invitation to attend. Do NOT ask them to RSVP or come watch.
- Open with something that proves you noticed this specific venue. Use the narrative / cuisine / vibe data when available to reference something concrete about the room. If hometown is provided for the artist, you may casually mention where they're traveling from (e.g. "I'm based out of {hometown}") — only when it adds context, never as a forced detail.
- Never a generic opener.
- If available dates are provided, state them confidently: "I have Friday the 24th available" not "I've got Friday wide open." Confident artists have dates available, not dates "wide open."
- Draw stats: weave ONE specific number naturally into the body ("rooms like this usually run 80-120 for me on a Thursday") — never a separate stats sentence.
- If an Instagram handle is provided, put it on its own line after the reel link so they can check before clicking.
- Banned phrasing: "I hope this email finds you well", "I wanted to reach out", "Quick offer:", "Hotel-booking style", "low risk", "no risk", "risk-free", "win-win", "zero risk", "wide open".
- No emojis. No exclamation points. No bold or markdown. Plain text.
- Under 115 words. 4 short paragraphs maximum.
- Address the decision maker by name if given. Otherwise: "Hi there" (bars/restaurants/owners), "Hi booking team" (music clubs/talent buyers), "Hi" (event coordinators).
- Sign off as the artist in first person. After the sign-off, add a line break then: "— Sent via Gigify" on its own line.

Subject line rules:
- 4-8 words. Lowercase except proper nouns.
- Must feel like a person typed it, not a marketer. Examples that work: "playing newmarket july 30 — open date?", "passing through cambridge in august", "8 miles from your room on july 23".
- Must reference distance, city, or date. Never use words like "exclusive", "incredible", "unique", "amazing".

Return strictly JSON: { "subject": "...", "body": "..." }`;

function buildUserPrompt(ctx: OutreachContext): string {
  const lines: string[] = [];
  lines.push(`Artist: ${ctx.artist.name} — ${ctx.artist.genre}`);
  if (ctx.artist.hometown) lines.push(`Hometown / based out of: ${ctx.artist.hometown}`);
  lines.push(`Bio: ${ctx.artist.bio}`);
  lines.push(`Typical draw: ${ctx.artist.drawDescription}`);
  if (ctx.artist.videoReelUrl) lines.push(`Reel (include in email): ${ctx.artist.videoReelUrl}`);
  if (ctx.artist.instagramHandle) lines.push(`Instagram (include on its own line after reel): instagram.com/${ctx.artist.instagramHandle.replace(/^@/, "")}`);
  lines.push("");
  lines.push(`Venue: ${ctx.venue.name} (${ctx.venue.venueType}) — ${ctx.venue.city}, ${ctx.venue.state}`);
  if (ctx.venue.narrative) lines.push(`What we know about the venue: ${ctx.venue.narrative}`);
  if (ctx.venue.cuisine) lines.push(`Cuisine: ${ctx.venue.cuisine}`);
  if (ctx.venue.vibe.length > 0) lines.push(`Vibe: ${ctx.venue.vibe.join(", ")}`);
  if (ctx.venue.hostsLiveMusic === true) {
    const g = ctx.venue.genresHosted.length > 0 ? ` (programs ${ctx.venue.genresHosted.join(", ")})` : "";
    lines.push(`Live music: yes${g}`);
  } else if (ctx.venue.hostsLiveMusic === false) {
    lines.push(`Live music: not historically — lean into "first-of-its-kind" framing.`);
  }
  if (ctx.venue.privateEventsFriendly) {
    lines.push(`Private events: this venue or owner appears to host private events. If the decision maker is an Owner, you may add one casual sentence at the end: "I also do private sets — parties, house concerts, events — if that's ever useful."`);
  }
  if (ctx.venue.decisionMakerName) {
    lines.push(`Decision maker: ${ctx.venue.decisionMakerName} (${ctx.venue.decisionMakerRole ?? "contact"})`);
  } else if (ctx.venue.decisionMakerRole) {
    lines.push(`Decision maker role (name unknown): ${ctx.venue.decisionMakerRole}`);
  } else {
    lines.push(`Decision maker: unknown — use a generic role-appropriate greeting`);
  }
  lines.push("");
  if (ctx.nearestShow) {
    lines.push(
      `Nearby confirmed show: ${ctx.nearestShow.venueName} in ${ctx.nearestShow.city}, ${ctx.nearestShow.state} on ${ctx.nearestShow.date} — ${ctx.nearestShow.distanceMiles} miles away`
    );
  } else {
    lines.push(`Nearby confirmed show: none — omit the proximity line entirely`);
  }
  if (ctx.availableDates.length > 0) {
    lines.push("");
    lines.push(
      `Available dates around the nearby show (must reference at least 2 of these as concrete options in the body):`
    );
    for (const d of ctx.availableDates) lines.push(`- ${d.pretty}`);
  } else {
    lines.push("");
    lines.push(`Available dates: not provided — keep the ask flexible.`);
  }
  lines.push("");
  lines.push(`Booking link (include verbatim, one click takes them to the offer): ${ctx.bookingLink}`);
  return lines.join("\n");
}

function humanDate(iso: string): string {
  // Accepts "2026-07-23" → "Thursday, July 23"
  const d = new Date(`${iso}T12:00:00Z`);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

// Deterministic pick from a list of variants based on the venue ID hash.
// Same venue always gets the same line — useful for A/B testing.
function pickVariant<T>(seed: string, variants: T[]): T {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return variants[Math.abs(h) % variants.length];
}

function greetingFor(ctx: OutreachContext): string {
  if (ctx.venue.decisionMakerName) {
    return `Hi ${ctx.venue.decisionMakerName.split(" ")[0]},`;
  }
  const role = (ctx.venue.decisionMakerRole ?? "").toLowerCase();
  if (ctx.venue.venueType === "MUSIC_CLUB" || role.includes("talent") || role.includes("booking")) {
    return "Hi booking team,";
  }
  if (role.includes("event") || role.includes("coordinator")) {
    return "Hi,";
  }
  return "Hi there,";
}

function openerFor(ctx: OutreachContext): string {
  const venueName = ctx.venue.name;
  const seed = ctx.venue.name + ctx.venue.city;

  // If we have venue narrative + a nearby show, lead with a venue-aware
  // observation. Way more personal than the generic openers.
  if (ctx.venue.narrative && ctx.nearestShow) {
    const date = humanDate(ctx.nearestShow.date);
    const miles = ctx.nearestShow.distanceMiles;
    const hometownTag = ctx.artist.hometown
      ? pickVariant(seed, [
          ` (I'm based out of ${ctx.artist.hometown})`,
          ``,
          ``, // dilute the hometown injection — only fires ~1/3 of the time
        ])
      : "";
    return pickVariant(seed, [
      `Took a quick look at ${venueName}${hometownTag} — feels like the right kind of room for what I do. I'm playing ${ctx.nearestShow.venueName} on ${date}, ${miles} miles from you, and wanted to ask about adding a date.`,
      `${venueName} stood out to me${hometownTag}. I'm playing ${ctx.nearestShow.venueName} on ${date} (${miles} mi from your spot) and trying to build the surrounding nights.`,
    ]);
  }

  if (!ctx.nearestShow) {
    return pickVariant(seed, [
      `Routing through ${ctx.venue.city} this summer and ${venueName} caught my eye.`,
      `Headed through ${ctx.venue.city} for some dates and wanted to ask about ${venueName}.`,
    ]);
  }
  const date = humanDate(ctx.nearestShow.date);
  const miles = ctx.nearestShow.distanceMiles;
  switch (ctx.venue.venueType) {
    case "MUSIC_CLUB":
      return pickVariant(seed, [
        `I'm playing ${ctx.nearestShow.venueName} in ${ctx.nearestShow.city} on ${date} — ${miles} miles from you. Trying to build out the surrounding nights and ${venueName} would be a strong fit.`,
        `Playing ${ctx.nearestShow.venueName} on ${date} (${miles} mi from your room) and looking for the right room to play in ${ctx.venue.city} that week.`,
      ]);
    case "ARTS_CENTER":
      return pickVariant(seed, [
        `I'm playing ${ctx.nearestShow.venueName} on ${date} — ${miles} miles from ${venueName}. Wanted to ask about an evening at your space around that stretch.`,
        `On ${date} I'm at ${ctx.nearestShow.venueName} in ${ctx.nearestShow.city}, ${miles} mi from you. Looking for an evening slot at ${venueName} the same week.`,
      ]);
    case "BAR":
      return pickVariant(seed, [
        `I'm playing ${ctx.nearestShow.venueName} on ${date}, ${miles} miles from ${venueName}. Trying to fill a weeknight either side of that.`,
        `Routing through ${ctx.venue.city} — playing ${ctx.nearestShow.venueName} on ${date} (${miles} mi out). Hoping to fill one of the slower nights at ${venueName}.`,
      ]);
    case "RESTAURANT":
      return pickVariant(seed, [
        `I'm playing ${ctx.nearestShow.venueName} on ${date} — ${miles} miles from you. Reaching out about live music during dinner service at ${venueName} that same week.`,
        `Playing ${ctx.nearestShow.venueName} on ${date} (${miles} mi from ${ctx.venue.city}) and trying to fill the days around it. Looking at acoustic dinner sets at ${venueName}.`,
      ]);
    default:
      return `I'm playing ${ctx.nearestShow.venueName} on ${date} — ${miles} miles from you. Hoping to add a ${ctx.venue.city} date to the swing.`;
  }
}

function formatDateWithContext(d: { pretty: string; timeContext?: string; sameDayShowName?: string }): string {
  if (!d.timeContext) return d.pretty;
  const prefix = d.sameDayShowName
    ? `${d.pretty} (${d.timeContext} — already playing ${d.sameDayShowName})`
    : `${d.pretty} (${d.timeContext})`;
  return prefix;
}

function datesLineFor(ctx: OutreachContext): string | null {
  if (ctx.availableDates.length === 0) return null;
  const formatted = ctx.availableDates.map(formatDateWithContext);
  let dateList: string;
  if (formatted.length === 1) {
    dateList = formatted[0];
  } else if (formatted.length === 2) {
    dateList = `${formatted[0]} or ${formatted[1]}`;
  } else {
    const head = formatted.slice(0, -1).join(", ");
    dateList = `${head}, or ${formatted[formatted.length - 1]}`;
  }
  // Check if any date has a same-day context — use different phrasing
  const hasSameDay = ctx.availableDates.some((d) => d.sameDayShowName);
  return hasSameDay
    ? pickVariant(ctx.venue.name + ctx.venue.city, [
        `I'm already in the area that week — also have ${dateList} open if the timing works.`,
        `Since I'm routing through anyway, ${dateList} could work if you have an opening.`,
        `I'm passing through that week — ${dateList} are open on my end.`,
      ])
    : pickVariant(ctx.venue.name + ctx.venue.city, [
        `Specifically, I have ${dateList} open if any of those line up.`,
        `Open dates that week: ${dateList}. Any of those work?`,
        `Could do ${dateList} on my end — happy to lock in whichever fits your calendar.`,
      ]);
}

function offerLineFor(ctx: OutreachContext): string {
  return pickVariant(ctx.venue.name + ctx.venue.city, [
    `Half the fee holds the date — and we both have skin in the game. If something changes in the first 24 hours, full refund, no questions.`,
    `Simple offer: 50% deposit locks the date for both of us. Full refund if either of us needs to back out in the first 24 hours.`,
    `Half deposit holds the date. That's a real commitment from me too — I show up prepared. Full refund available in the first 24 hours if anything changes on your end.`,
  ]);
}

function gigifyFooter(artistEmail: string): string {
  return `\n\n---\nSent via Gigify · ${artistEmail}`;
}

function linkLineFor(ctx: OutreachContext): string {
  return ctx.artist.videoReelUrl
    ? pickVariant(ctx.venue.name + ctx.venue.city, [
        `60-second reel and a one-click booking link: ${ctx.bookingLink}`,
        `Reel, recent rooms, and a direct booking link: ${ctx.bookingLink}`,
        `Everything (reel, dates, the booking flow) lives here: ${ctx.bookingLink}`,
      ])
    : `Booking flow: ${ctx.bookingLink}`;
}

function drawLineFor(ctx: OutreachContext): string | null {
  // Light touch — only on weeknight venues where draw matters.
  if (ctx.venue.venueType === "MUSIC_CLUB" || ctx.venue.venueType === "BAR") {
    return pickVariant(ctx.venue.name + ctx.venue.city, [
      `For context on draw: ${ctx.artist.drawDescription.toLowerCase()}.`,
      `Typical room: ${ctx.artist.drawDescription.toLowerCase()}.`,
    ]);
  }
  return null;
}

function subjectFor(ctx: OutreachContext): string {
  const city = ctx.venue.city;
  const seed = ctx.venue.name + ctx.venue.city + ctx.venue.city;
  if (ctx.nearestShow) {
    const miles = ctx.nearestShow.distanceMiles;
    return pickVariant(seed, [
      `passing through ${city} on ${humanDate(ctx.nearestShow.date).split(",")[1]?.trim() ?? ctx.nearestShow.date}`,
      `playing ${miles}mi from you on ${humanDate(ctx.nearestShow.date).split(",")[1]?.trim() ?? ctx.nearestShow.date}`,
      `${miles} miles from ${ctx.venue.name.split(" ").slice(0, 3).join(" ")}`,
      `open date in ${city}?`,
    ]);
  }
  return pickVariant(seed, [
    `routing through ${city} this summer`,
    `open ${city} dates?`,
    `${ctx.artist.name.split(" ")[0]} — ${city} routing`,
  ]);
}

function templateFallback(ctx: OutreachContext): GeneratedEmail {
  const greeting = greetingFor(ctx);
  const opener = openerFor(ctx);
  const dates = datesLineFor(ctx);
  const offer = offerLineFor(ctx);
  const link = linkLineFor(ctx);
  const draw = drawLineFor(ctx);
  const subject = subjectFor(ctx);

  const paragraphs = [greeting, "", opener];
  if (dates) paragraphs.push("", dates);
  paragraphs.push("", offer, "", link);
  if (draw) paragraphs.push("", draw);
  paragraphs.push("", `— ${ctx.artist.name}`);
  paragraphs.push(gigifyFooter(ctx.artist.epkUrl ?? "booking@gigify.io"));

  return { subject, body: paragraphs.join("\n"), source: "template" };
}

export async function generateOutreachEmail(ctx: OutreachContext): Promise<GeneratedEmail> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { ...templateFallback(ctx), fallbackReason: "ANTHROPIC_API_KEY not set in process.env (server restart needed?)" };
  }

  try {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 700,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildUserPrompt(ctx) }],
    });

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("Claude returned no JSON block");
    const parsed = JSON.parse(jsonMatch[0]) as { subject: string; body: string };
    if (!parsed.subject || !parsed.body) throw new Error("Claude returned missing subject or body");

    return { subject: parsed.subject, body: parsed.body, source: "claude" };
  } catch (err) {
    const reason = err instanceof Error ? err.message : "unknown Claude error";
    console.error("[claude] generation failed, falling back to template:", reason);
    return { ...templateFallback(ctx), fallbackReason: reason };
  }
}
