// Nova voice agent scripts. Three variants by venue type / decision maker role.
// Every script shares the core pitch from the build guide.

export type ScriptVariant = "owner" | "talent_buyer" | "event_coordinator";

export type ScriptContext = {
  artistName: string;
  artistGenre: string;
  venueName: string;
  decisionMakerFirstName: string | null;
  nearestShow: {
    venueName: string;
    city: string;
    date: string; // YYYY-MM-DD
    distanceMiles: number;
  } | null;
};

export type ScriptSection = {
  label: string;
  body: string;
};

export function variantForRole(role: string | null | undefined): ScriptVariant {
  if (!role) return "owner";
  const r = role.toLowerCase();
  if (r.includes("talent")) return "talent_buyer";
  if (r.includes("coordinator") || r.includes("event")) return "event_coordinator";
  return "owner";
}

function nearestShowLine(ctx: ScriptContext): string {
  if (!ctx.nearestShow) return `He's routing through the area this summer.`;
  return `He's actually playing just down the road in ${ctx.nearestShow.city} on ${ctx.nearestShow.date} — ${ctx.nearestShow.distanceMiles} miles from you — if you ever wanted to swing by, but no pressure.`;
}

function greeting(ctx: ScriptContext, variant: ScriptVariant): string {
  const who = ctx.decisionMakerFirstName ?? (variant === "talent_buyer" ? "the booking team" : "the manager");
  return `Hi, is this ${who}? This is Nova, calling on behalf of ${ctx.artistName} through Gigify Booking.`;
}

const CORE_PITCH = (ctx: ScriptContext) =>
  `${ctx.artistName} is a ${ctx.artistGenre} artist already confirmed and touring in your area this summer. Simple offer: 50% deposit holds a date, and if anything changes you've got 24 hours to cancel for a full refund — no questions. Can I send you the reel and a booking link right now?`;

export function buildScript(ctx: ScriptContext, variant: ScriptVariant): ScriptSection[] {
  const sections: ScriptSection[] = [];

  sections.push({ label: "Opening", body: greeting(ctx, variant) });

  if (variant === "owner") {
    sections.push({
      label: "Hook",
      body: `Quick reason for the call — I work with independent touring artists, and ${ctx.artistName} is heading through your area. Wanted to see if you'd be open to a date.`,
    });
  } else if (variant === "talent_buyer") {
    sections.push({
      label: "Hook",
      body: `Hoping you can help — I have an indie folk artist with a strong routing through your market and I'd love to get a hold on a date if you have room.`,
    });
  } else {
    sections.push({
      label: "Hook",
      body: `I'm reaching out about a touring artist who'd be a strong fit for your event programming — quick to set up and risk-free on your end.`,
    });
  }

  sections.push({ label: "Proximity proof", body: nearestShowLine(ctx) });

  sections.push({ label: "Core pitch", body: CORE_PITCH(ctx) });

  sections.push({
    label: "Objection: 'send me info'",
    body: `Absolutely — best email? Sending the reel and booking link now.`,
  });
  sections.push({
    label: "Objection: 'we're full'",
    body: `Understood — would fall dates work? He's routing back through.`,
  });
  sections.push({
    label: "Objection: 'what's the draw?'",
    body: `80–150 on weeknights in similar markets. The reel shows it better — want me to send it?`,
  });
  sections.push({
    label: "Objection: 'need to think'",
    body: `Of course — I'll send everything over. Remember the 24-hour cancel if anything changes.`,
  });
  sections.push({
    label: "Voicemail (30s)",
    body: `Hi, this is Nova calling for ${ctx.venueName} on behalf of ${ctx.artistName} through Gigify Booking. ${ctx.artistName} is touring your area this summer with a simple offer: 50% deposit holds the date, and if anything changes you've got 24 hours to cancel — full refund, no questions. I'll send the reel and booking link to your inbox. Thanks.`,
  });

  return sections;
}
