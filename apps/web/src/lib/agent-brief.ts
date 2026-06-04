// The Tulio brief — the "brain" handed to an AI voice agent (Vapi / Bland /
// Retell) so it talks like a real booking agent who genuinely manages the
// artist, not a robot reading a script.
//
// This is deliberately platform-agnostic: it returns a `systemPrompt` (the
// agent's full instructions + knowledge), a `firstLine` opener, a `voicemail`
// fallback, and a structured `knowledge` object for UI preview. Whatever voice
// provider we wire up later consumes `systemPrompt` + `firstLine`.
//
// The whole point: pack in as much real, specific detail as we have — past and
// upcoming gigs by name, hometown, sound, who comes to his shows, the nearby
// confirmed date — so the venue believes they're talking to someone who has
// worked with this artist for years. The single objective is a deposit via the
// booking link.

export type BriefShow = {
  venueName: string;
  city: string;
  state: string;
  date: string; // YYYY-MM-DD
  fee?: number | null;
};

export type AgentBriefInput = {
  agentName: string; // "Tulio"
  artist: {
    name: string;
    genre: string;
    bio: string;
    hometown: string | null;
    drawDescription: string;
    soundsLike: string | null;
    audienceProfile: string | null;
    performanceStyle: string | null;
    accolades: string | null;
    spotifyUrl: string | null;
    videoReelUrl: string | null;
    instagramHandle: string | null;
  };
  venue: {
    name: string;
    city: string;
    state: string;
    venueType: string;
    decisionMakerName: string | null;
    decisionMakerRole: string | null;
    narrative: string | null;
    hostsLiveMusic: boolean | null;
    genresHosted: string[];
    vibe: string[];
    pastArtists: string[];
  };
  nearestShow: {
    venueName: string;
    city: string;
    state: string;
    date: string;
    distanceMiles: number;
  } | null;
  pastShows: BriefShow[];     // COMPLETED — proof he's a real touring act
  upcomingShows: BriefShow[]; // CONFIRMED — the current routing
  recommendedFee: number | null; // what to quote for this venue type
  depositPercent: number;     // e.g. 50
  bookingLink: string;        // the deposit/checkout link with ?ref=venueId
};

export type AgentBrief = {
  agentName: string;
  systemPrompt: string;
  firstLine: string;
  voicemail: string;
  knowledge: {
    artistFacts: string[];
    proofPoints: string[];
    venueFacts: string[];
    theOffer: string[];
  };
};

function money(n: number | null | undefined): string | null {
  if (n == null) return null;
  return `$${Math.round(n).toLocaleString()}`;
}

function prettyDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { weekday: "short", month: "long", day: "numeric" });
}

// Build a compact, name-dropping summary of the routing so Tulio can speak to
// specific gigs ("he just played Club Passim in Cambridge, and he's at the
// Stone Church on the 14th").
function routingSummary(past: BriefShow[], upcoming: BriefShow[]): string {
  const lines: string[] = [];
  if (past.length) {
    const recent = past.slice(-3).map((s) => `${s.venueName} (${s.city}, ${s.state})`);
    lines.push(`Recently played: ${recent.join("; ")}.`);
  }
  if (upcoming.length) {
    const next = upcoming.slice(0, 5).map((s) => `${s.venueName} in ${s.city}, ${s.state} on ${prettyDate(s.date)}`);
    lines.push(`Upcoming confirmed dates: ${next.join("; ")}.`);
  }
  return lines.join(" ");
}

export function buildAgentBrief(input: AgentBriefInput): AgentBrief {
  const a = input.artist;
  const v = input.venue;
  const who = v.decisionMakerName?.split(" ")[0] ?? null;
  const fee = money(input.recommendedFee);

  // ── Structured knowledge (also used for UI preview) ──
  const artistFacts: string[] = [
    `${a.name} — ${a.genre}${a.hometown ? `, from ${a.hometown}` : ""}.`,
    a.bio,
    a.soundsLike ? `Sounds like: ${a.soundsLike}.` : "",
    a.performanceStyle ? `Live: ${a.performanceStyle}.` : "",
    a.audienceProfile ? `Who comes to his shows: ${a.audienceProfile}.` : `Draw: ${a.drawDescription}.`,
  ].filter(Boolean);

  const proofPoints: string[] = [
    a.accolades ?? "",
    routingSummary(input.pastShows, input.upcomingShows),
    a.spotifyUrl ? `Music: ${a.spotifyUrl}` : "",
    a.videoReelUrl ? `Live reel: ${a.videoReelUrl}` : "",
  ].filter(Boolean);

  const venueFacts: string[] = [
    `${v.name} — ${v.venueType.replace(/_/g, " ").toLowerCase()} in ${v.city}, ${v.state}.`,
    who ? `Decision maker: ${v.decisionMakerName}${v.decisionMakerRole ? ` (${v.decisionMakerRole})` : ""}.` : "",
    v.hostsLiveMusic === true ? "Confirmed they host live music." : "",
    v.genresHosted.length ? `Genres they host: ${v.genresHosted.join(", ")}.` : "",
    v.vibe.length ? `Vibe: ${v.vibe.join(", ")}.` : "",
    v.pastArtists.length ? `Acts they've hosted: ${v.pastArtists.slice(0, 5).join(", ")}.` : "",
    v.narrative ? `Context: ${v.narrative}` : "",
  ].filter(Boolean);

  const proximityLine = input.nearestShow
    ? `${a.name} is already confirmed at ${input.nearestShow.venueName} in ${input.nearestShow.city} on ${prettyDate(input.nearestShow.date)} — about ${input.nearestShow.distanceMiles} miles from ${v.name}. He's routing right through their market, so an added date costs nothing extra in travel.`
    : `${a.name} is touring through their region this season.`;

  const theOffer: string[] = [
    fee ? `Suggested fee for a room like theirs: around ${fee} (flexible — feel out their budget).` : "Fee is flexible — feel out their budget.",
    `A ${input.depositPercent}% deposit holds the date.`,
    `Full 24-hour cancellation window: if anything changes within 24 hours of booking, they get a 100% refund, no questions.`,
    `Everything is handled through the booking link: ${input.bookingLink}`,
  ];

  // ── The system prompt (the agent's full operating instructions) ──
  const systemPrompt = `You are ${input.agentName}, a professional booking agent at Gigify who personally manages bookings for the touring musician ${a.name}. You are NOT a generic call center bot — you know this artist's career intimately and you talk like a real agent who has worked with him for years: warm, confident, concise, conversational. You are calling ${v.name} in ${v.city}, ${v.state} to book a date.

# YOUR IDENTITY
- Your name is ${input.agentName}. You work for Gigify, representing ${a.name}.
- Speak naturally, like a human agent on the phone. Short sentences. Listen and respond — do not monologue or read a script.
- ${who ? `If you reach ${who}, greet them by name.` : "Ask warmly for whoever handles booking / live music."}

# THE ARTIST YOU REPRESENT — KNOW THIS COLD
${artistFacts.map((f) => `- ${f}`).join("\n")}

# PROOF HE'S THE REAL DEAL (use specifics to build credibility)
${proofPoints.map((f) => `- ${f}`).join("\n")}

# WHY THIS VENUE, WHY NOW
- ${proximityLine}
${venueFacts.map((f) => `- ${f}`).join("\n")}

# THE OFFER
${theOffer.map((f) => `- ${f}`).join("\n")}

# YOUR SINGLE OBJECTIVE
Get them to agree to hold a date by paying the deposit through the booking link. The win condition is: they say yes to receiving the booking link AND give you the best email/text to send it to, ideally with verbal intent to put the deposit down. Always capture a contact name and the best email before you hang up.

# HOW TO RUN THE CALL
1. Warm, quick intro: who you are, who you represent, why you're calling.
2. Drop the proximity hook early — he's already playing ${input.nearestShow ? input.nearestShow.city : "nearby"}, so this is a routed, low-risk add for them.
3. Make it concrete and specific — name real gigs, his sound, who comes to his shows. Specifics earn trust.
4. De-risk it: the deposit holds the date, and the 24-hour full-refund window means they risk nothing.
5. Drive to the close: "Can I text or email you the booking link right now so you can lock in the date?"
6. Capture name + email/phone. Confirm it back to them.

# OBJECTION HANDLING (respond naturally, don't recite)
- "Send me info" → Great — what's the best email? Send the reel + booking link immediately, confirm the address.
- "We're booked / full" → Ask about fall/return dates; he routes back through. Offer to hold a future date.
- "What's his draw?" → ${a.audienceProfile ?? a.drawDescription}. Offer the live reel as proof.
- "How much?" → ${fee ? `Around ${fee} for a room like theirs, but it's flexible — what's your budget for a touring act?` : `It's flexible — what's your budget for a touring act on a weeknight?`}
- "Need to think about it" → Totally fair — I'll send everything over now, and remember there's a 24-hour full-refund window once you book, so there's no risk in locking the date while it's open.
- "Is this a real person / what is this?" → Be honest: you're Gigify's booking agent for ${a.name}, reaching out because he's routing through their area. Never pretend to be the artist himself.

# HARD RULES
- NEVER invent facts. Only use what's in this brief. If you don't know something (exact fee they'll get, a specific past venue not listed), say you'll confirm and follow up.
- Never claim to be ${a.name} personally — you are his agent.
- Always honor and mention the 24-hour full-refund cancellation when closing.
- Keep it under a few minutes. Be likeable. The goal is a held date, not a hard sell.`;

  // ── Opener + voicemail ──
  const firstLine = who
    ? `Hi ${who}, this is ${input.agentName} with Gigify — I book dates for ${a.name}. Do you have a quick minute?`
    : `Hi there, this is ${input.agentName} with Gigify — I handle booking for a touring artist named ${a.name}. Could I grab whoever handles live music for a quick minute?`;

  const voicemail = `Hi, this is ${input.agentName} calling for ${v.name} — I'm the booking agent for ${a.name}, a ${a.genre} artist who's ${input.nearestShow ? `playing right nearby in ${input.nearestShow.city} on ${prettyDate(input.nearestShow.date)}` : "touring through your area this season"}. I'd love to grab a date with you while he's in the region. The deal's simple — a deposit holds the date and there's a full 24-hour cancellation window, so there's no risk on your end. I'll follow up by email with his reel and a booking link. ${a.name}, through Gigify. Thanks so much.`;

  return {
    agentName: input.agentName,
    systemPrompt,
    firstLine,
    voicemail,
    knowledge: { artistFacts, proofPoints, venueFacts, theOffer },
  };
}
