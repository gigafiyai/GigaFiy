// Turns raw scraped venue text into structured intelligence the email engine
// can reason about. One Claude call per venue; result cached in DB until the
// narrative text changes meaningfully.

import Anthropic from "@anthropic-ai/sdk";

const MODEL = "claude-sonnet-4-5";

export type VenueAnalysis = {
  narrative: string | null; // 1-2 sentence summary for email context
  hostsLiveMusic: boolean | null;
  genresHosted: string[]; // e.g. ["folk", "americana", "jazz"]
  cuisine: string | null; // restaurants only
  vibe: string[]; // e.g. ["cozy", "intimate", "listening room"]
  priceRange: string | null; // "$" to "$$$$"
  foundedYear: number | null;
  pastArtists: string[]; // recognizable performer names if any
};

const SYSTEM_PROMPT = `You analyze venue website text and produce structured data about the venue. Be precise. Never invent details — if the text doesn't mention something, leave the field empty/null.

Specifically extract:
- "narrative": one or two SHORT sentences describing the venue — what it is, what makes it distinctive. Written in plain English, never marketing copy. Examples that work: "Family-run pizza place that turns into a folk listening room on Tuesdays." "Intimate 60-seat jazz club in the Berkshires with a tasting menu." Avoid generic ("a great restaurant") — only include detail you can see in the source text.
- "hostsLiveMusic": true if the venue clearly hosts live music (mentions performances, concerts, music series, open mic, etc.); false if it explicitly doesn't or if it's the type of place that wouldn't (chain fast food, fast casual); null if you can't tell.
- "genresHosted": array of genres the venue programs (folk, americana, indie, jazz, classical, rock, country, electronic, hip-hop, blues, soul, world). Empty array if no live music or unclear.
- "cuisine": short food type — "italian", "american", "thai", "pizza", "bbq", "vegetarian", "seafood", "tapas", "farm-to-table", etc. Null if not a restaurant.
- "vibe": array of 1-4 lowercase descriptors that capture atmosphere — "intimate", "loud", "cozy", "upscale", "casual", "rustic", "modern", "dive", "outdoor patio", "speakeasy", "family-friendly", "date-night", "listening room", "rowdy". Only what's clearly in the text.
- "priceRange": "$", "$$", "$$$", or "$$$$" if you can tell. Null otherwise.
- "foundedYear": four-digit year if the text says something like "established 1987" or "since 2010". Null otherwise.
- "pastArtists": short array of recognizable musical performers explicitly mentioned as having played there. Skip if none mentioned. Don't infer.

Return strictly JSON matching this schema. Use null (not "unknown") for unknown values.`;

export async function analyzeVenueNarrative(opts: {
  venueName: string;
  city: string;
  state: string;
  venueType: string;
  rawText: string;
}): Promise<VenueAnalysis | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  if (!opts.rawText || opts.rawText.length < 100) return null;

  try {
    const client = new Anthropic({ apiKey });
    const userPrompt = [
      `Venue: ${opts.venueName} (${opts.venueType})`,
      `Location: ${opts.city}, ${opts.state}`,
      "",
      `Scraped website text:`,
      `"""`,
      opts.rawText.slice(0, 4000),
      `"""`,
    ].join("\n");

    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 800,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    });

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const parsed = JSON.parse(match[0]) as Partial<VenueAnalysis>;
    return {
      narrative: parsed.narrative ?? null,
      hostsLiveMusic: parsed.hostsLiveMusic ?? null,
      genresHosted: Array.isArray(parsed.genresHosted) ? parsed.genresHosted : [],
      cuisine: parsed.cuisine ?? null,
      vibe: Array.isArray(parsed.vibe) ? parsed.vibe : [],
      priceRange: parsed.priceRange ?? null,
      foundedYear: parsed.foundedYear ?? null,
      pastArtists: Array.isArray(parsed.pastArtists) ? parsed.pastArtists : [],
    };
  } catch (e) {
    console.error("[venue-analyzer] failed:", e instanceof Error ? e.message : e);
    return null;
  }
}
