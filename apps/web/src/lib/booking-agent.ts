// Booking-Agent.io enrichment — looks up named talent buyer contacts for venues.
//
// The exact API shape is configurable via env vars because the real
// Booking-Agent.io contract may differ from the defaults here. Once you have a
// key + their docs, matching the real API is usually just env config, not code:
//
//   BOOKING_AGENT_API_KEY      (required) your key
//   BOOKING_AGENT_BASE_URL     default https://api.booking-agent.io/v1
//   BOOKING_AGENT_PATH         default /contacts/search
//   BOOKING_AGENT_METHOD       POST | GET   (default POST)
//   BOOKING_AGENT_AUTH_STYLE   bearer | header | query   (default bearer)
//   BOOKING_AGENT_AUTH_HEADER  header name for "header" style (default X-API-Key)
//   BOOKING_AGENT_AUTH_PARAM   query param for "query" style (default api_key)
//   BOOKING_AGENT_DEBUG        "1" logs the raw response so we can match the shape

const BASE_URL = process.env.BOOKING_AGENT_BASE_URL ?? "https://api.booking-agent.io/v1";
const PATH = process.env.BOOKING_AGENT_PATH ?? "/contacts/search";
const METHOD = (process.env.BOOKING_AGENT_METHOD ?? "POST").toUpperCase();
const AUTH_STYLE = (process.env.BOOKING_AGENT_AUTH_STYLE ?? "bearer").toLowerCase();
const AUTH_HEADER = process.env.BOOKING_AGENT_AUTH_HEADER ?? "X-API-Key";
const AUTH_PARAM = process.env.BOOKING_AGENT_AUTH_PARAM ?? "api_key";
const DEBUG = process.env.BOOKING_AGENT_DEBUG === "1";

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

type RawContact = {
  name?: string;
  full_name?: string;
  fullName?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  emailAddress?: string;
  phone?: string;
  phone_number?: string;
  phoneNumber?: string;
  title?: string;
  role?: string;
  job_title?: string;
  jobTitle?: string;
  position?: string;
};

// Pulls a contact array out of whatever envelope the API returns.
function extractContacts(data: unknown): RawContact[] {
  if (Array.isArray(data)) return data as RawContact[];
  if (data && typeof data === "object") {
    const o = data as Record<string, unknown>;
    for (const key of ["contacts", "results", "data", "items", "people"]) {
      const v = o[key];
      if (Array.isArray(v)) return v as RawContact[];
      // One level deeper: { data: { contacts: [...] } }
      if (v && typeof v === "object") {
        const inner = v as Record<string, unknown>;
        for (const k2 of ["contacts", "results", "items", "people"]) {
          if (Array.isArray(inner[k2])) return inner[k2] as RawContact[];
        }
      }
    }
  }
  return [];
}

function name(c: RawContact): string | null {
  return (
    c.name ??
    c.full_name ??
    c.fullName ??
    ([c.first_name, c.last_name].filter(Boolean).join(" ") || null)
  );
}
function email(c: RawContact): string | null {
  return c.email ?? c.emailAddress ?? null;
}
function phone(c: RawContact): string | null {
  return c.phone ?? c.phone_number ?? c.phoneNumber ?? null;
}
function title(c: RawContact): string | null {
  return c.title ?? c.role ?? c.job_title ?? c.jobTitle ?? c.position ?? null;
}

function pickBest(list: RawContact[]): EnrichedContact | null {
  if (list.length === 0) return null;
  const score = (t: string | null): number => {
    if (!t) return 0;
    const lc = t.toLowerCase();
    if (/talent|book/.test(lc)) return 4;
    if (/event/.test(lc)) return 3;
    if (/owner/.test(lc)) return 2;
    if (/manager|gm/.test(lc)) return 1;
    return 0;
  };
  const ranked = [...list].sort((a, b) => score(title(b)) - score(title(a)));
  const c = ranked[0];
  const n = name(c);
  if (!n) return null;
  return { name: n, email: email(c), phone: phone(c), title: title(c), source: "booking_agent" };
}

export async function enrichVenueContact(opts: {
  venueName: string;
  city: string;
  state: string;
}): Promise<EnrichmentResult> {
  const apiKey = process.env.BOOKING_AGENT_API_KEY;
  if (!apiKey) return { ok: false, reason: "no_key" };

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (AUTH_STYLE === "bearer") headers["Authorization"] = `Bearer ${apiKey}`;
  else if (AUTH_STYLE === "header") headers[AUTH_HEADER] = apiKey;

  const query = {
    venue_name: opts.venueName,
    name: opts.venueName,
    city: opts.city,
    state: opts.state,
    role_keywords: ["talent buyer", "booking", "events", "owner", "manager"],
  };

  let url = `${BASE_URL}${PATH}`;
  const init: RequestInit = { method: METHOD, headers };

  if (METHOD === "GET") {
    const params = new URLSearchParams({
      venue_name: opts.venueName,
      city: opts.city,
      state: opts.state,
    });
    if (AUTH_STYLE === "query") params.set(AUTH_PARAM, apiKey);
    url = `${url}?${params.toString()}`;
  } else {
    if (AUTH_STYLE === "query") url = `${url}?${AUTH_PARAM}=${encodeURIComponent(apiKey)}`;
    init.body = JSON.stringify(query);
  }

  try {
    const res = await fetch(url, init);
    if (res.status === 429) return { ok: false, reason: "rate_limited" };
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      if (DEBUG) console.log(`[booking-agent] ${res.status} for ${opts.venueName}: ${text.slice(0, 300)}`);
      return { ok: false, reason: "error", error: `${res.status}: ${text.slice(0, 200)}` };
    }

    const data = await res.json();
    if (DEBUG) console.log(`[booking-agent] raw for ${opts.venueName}:`, JSON.stringify(data).slice(0, 500));

    const contact = pickBest(extractContacts(data));
    if (!contact) return { ok: false, reason: "no_match" };
    return { ok: true, contact };
  } catch (e) {
    return { ok: false, reason: "error", error: e instanceof Error ? e.message : "fetch failed" };
  }
}
