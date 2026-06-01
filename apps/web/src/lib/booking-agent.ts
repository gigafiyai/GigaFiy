// Booking-Agent.io enrichment — looks up named talent buyer contacts for venues.
//
// IMPORTANT: the exact endpoint shape below is a best-guess based on common
// patterns for B2B contact-data APIs. Verify against booking-agent.io's real
// docs before going live; swap BASE_URL / path / auth header / response shape
// as needed. The rest of the codebase only depends on the exported function
// signatures, so changes are local to this file.

const BASE_URL = process.env.BOOKING_AGENT_BASE_URL ?? "https://api.booking-agent.io/v1";

export type EnrichedContact = {
  name: string;
  email: string | null;
  phone: string | null;
  title: string | null;
  source: "booking_agent";
};

export type EnrichmentResult =
  | { ok: true; contact: EnrichedContact }
  | { ok: false; reason: "no_match" | "no_key" | "rate_limited" | "error"; error?: string };

type BookingAgentResponse = {
  contacts?: Array<{
    name?: string;
    full_name?: string;
    email?: string;
    phone?: string;
    phone_number?: string;
    title?: string;
    role?: string;
    job_title?: string;
  }>;
};

function pickBest(resp: BookingAgentResponse): EnrichedContact | null {
  const list = resp.contacts ?? [];
  if (list.length === 0) return null;
  // Prefer a contact whose title contains 'book', 'talent', 'event', 'manager', 'owner'.
  const score = (t: string | undefined): number => {
    if (!t) return 0;
    const lc = t.toLowerCase();
    if (/talent|book/.test(lc)) return 4;
    if (/event/.test(lc)) return 3;
    if (/owner/.test(lc)) return 2;
    if (/manager|gm/.test(lc)) return 1;
    return 0;
  };
  const ranked = [...list].sort(
    (a, b) =>
      score(b.title ?? b.role ?? b.job_title) -
      score(a.title ?? a.role ?? a.job_title)
  );
  const c = ranked[0];
  const name = c.name ?? c.full_name ?? null;
  if (!name) return null;
  return {
    name,
    email: c.email ?? null,
    phone: c.phone ?? c.phone_number ?? null,
    title: c.title ?? c.role ?? c.job_title ?? null,
    source: "booking_agent",
  };
}

export async function enrichVenueContact(opts: {
  venueName: string;
  city: string;
  state: string;
}): Promise<EnrichmentResult> {
  const apiKey = process.env.BOOKING_AGENT_API_KEY;
  if (!apiKey) return { ok: false, reason: "no_key" };

  try {
    const res = await fetch(`${BASE_URL}/contacts/search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        venue_name: opts.venueName,
        city: opts.city,
        state: opts.state,
        // Booking-Agent.io is venue-centric; restrict to live music decision makers.
        role_keywords: ["talent buyer", "booking", "events", "owner", "manager"],
      }),
    });

    if (res.status === 429) return { ok: false, reason: "rate_limited" };
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { ok: false, reason: "error", error: `${res.status}: ${text.slice(0, 200)}` };
    }

    const data = (await res.json()) as BookingAgentResponse;
    const contact = pickBest(data);
    if (!contact) return { ok: false, reason: "no_match" };
    return { ok: true, contact };
  } catch (e) {
    return {
      ok: false,
      reason: "error",
      error: e instanceof Error ? e.message : "fetch failed",
    };
  }
}
