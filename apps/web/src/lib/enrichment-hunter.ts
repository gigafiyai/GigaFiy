// Hunter.io email finder — Tier 2.5 enrichment.
// Free: 25 searches/month. Paid: $49/mo for 500 searches.
// Docs: https://hunter.io/api-documentation/v2
//
// Strategy: given a venue's website domain, find the email most likely to
// belong to the booking decision-maker. Runs AFTER web-scrape fails so we
// only burn quota on genuinely missed venues.

const BASE_URL = "https://api.hunter.io/v2";

type HunterEmailFinder = {
  data?: {
    email?: string;
    score?: number;
    first_name?: string;
    last_name?: string;
    position?: string;
    department?: string;
  };
  errors?: Array<{ id: string; code: number; details: string }>;
  meta?: { params?: { domain?: string } };
};

type HunterDomainSearch = {
  data?: {
    emails?: Array<{
      value: string;
      type: string;
      department?: string;
      seniority?: string;
      first_name?: string;
      last_name?: string;
      position?: string;
    }>;
  };
  errors?: Array<{ id: string; code: number; details: string }>;
};

export type HunterResult =
  | { ok: true; email: string; firstName: string | null; lastName: string | null; position: string | null; score: number }
  | { ok: false; reason: "no_key" | "not_found" | "quota" | "error"; error?: string };

function extractDomain(websiteUrl: string): string | null {
  try {
    const u = new URL(websiteUrl);
    return u.hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

// Scores emails to pick the best one for booking outreach.
function scoreEmail(email: { value: string; department?: string; position?: string; seniority?: string }): number {
  let score = 0;
  const lc = (email.department ?? "").toLowerCase() + " " + (email.position ?? "").toLowerCase();
  if (/booking|talent|music|event|entertainment|programming/i.test(lc)) score += 100;
  else if (/manager|general|gm|owner|director|head/i.test(lc)) score += 60;
  else if (/marketing|pr|communications/i.test(lc)) score += 20;
  else if (/info|contact|hello/i.test(email.value.split("@")[0])) score += 10;
  if (email.seniority === "executive" || email.seniority === "senior") score += 20;
  return score;
}

export async function findEmailViaHunter(opts: {
  website: string;
  venueName: string;
  apiKey: string;
}): Promise<HunterResult> {
  const domain = extractDomain(opts.website);
  if (!domain) return { ok: false, reason: "not_found", error: "Could not parse domain" };

  // Try domain search first — gives us all known emails for the domain so we
  // can pick the best one. Falls back to a point-in-time finder if no results.
  try {
    const searchUrl = new URL(`${BASE_URL}/domain-search`);
    searchUrl.searchParams.set("domain", domain);
    searchUrl.searchParams.set("api_key", opts.apiKey);
    searchUrl.searchParams.set("limit", "10");
    searchUrl.searchParams.set("type", "personal");

    const res = await fetch(searchUrl.toString(), {
      headers: { Accept: "application/json" },
    });

    if (res.status === 429 || res.status === 402) {
      return { ok: false, reason: "quota" };
    }
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { ok: false, reason: "error", error: `${res.status}: ${text.slice(0, 200)}` };
    }

    const data = (await res.json()) as HunterDomainSearch;
    const emails = data.data?.emails ?? [];
    if (emails.length > 0) {
      const ranked = [...emails].sort((a, b) => scoreEmail(b) - scoreEmail(a));
      const best = ranked[0];
      return {
        ok: true,
        email: best.value,
        firstName: best.first_name ?? null,
        lastName: best.last_name ?? null,
        position: best.position ?? null,
        score: scoreEmail(best),
      };
    }
  } catch (e) {
    return {
      ok: false,
      reason: "error",
      error: e instanceof Error ? e.message : "domain search failed",
    };
  }

  return { ok: false, reason: "not_found" };
}
