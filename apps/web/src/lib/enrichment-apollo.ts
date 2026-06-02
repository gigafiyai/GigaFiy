// Apollo.io people-match enrichment — Tier 2.5b.
// When we have an owner NAME from our scraper but no email, Apollo can
// find their personal email given name + company. Free: 50 credits/month.
// Docs: https://apolloio.github.io/apollo-api-docs/#people-match

const BASE_URL = "https://api.apollo.io/api/v1";

type ApolloMatchResponse = {
  person?: {
    first_name?: string;
    last_name?: string;
    email?: string;
    email_status?: string; // "verified" | "likely" | etc.
    title?: string;
    linkedin_url?: string;
    phone_numbers?: Array<{ raw_number: string; type: string }>;
  };
  error_code?: string;
  error_message?: string;
};

export type ApolloResult =
  | {
      ok: true;
      email: string;
      emailStatus: string;
      firstName: string | null;
      lastName: string | null;
      title: string | null;
      linkedinUrl: string | null;
      phone: string | null;
    }
  | { ok: false; reason: "no_key" | "no_match" | "quota" | "error"; error?: string };

export async function findOwnerViaApollo(opts: {
  firstName: string;
  lastName: string;
  organizationName: string;
  domain?: string;
}): Promise<ApolloResult> {
  const apiKey = process.env.APOLLO_API_KEY;
  if (!apiKey) return { ok: false, reason: "no_key" };

  try {
    const res = await fetch(`${BASE_URL}/people/match`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
        "X-Api-Key": apiKey,
      },
      body: JSON.stringify({
        first_name: opts.firstName,
        last_name: opts.lastName,
        organization_name: opts.organizationName,
        ...(opts.domain ? { domain: opts.domain } : {}),
        reveal_personal_emails: true, // needed for personal emails
      }),
    });

    if (res.status === 429) return { ok: false, reason: "quota" };
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { ok: false, reason: "error", error: `${res.status}: ${text.slice(0, 200)}` };
    }

    const data = (await res.json()) as ApolloMatchResponse;
    if (!data.person?.email) return { ok: false, reason: "no_match" };

    const p = data.person;
    const phone = p.phone_numbers?.find((ph) => ph.type === "direct_phone")?.raw_number ??
      p.phone_numbers?.[0]?.raw_number ?? null;

    return {
      ok: true,
      email: p.email!,
      emailStatus: p.email_status ?? "unknown",
      firstName: p.first_name ?? null,
      lastName: p.last_name ?? null,
      title: p.title ?? null,
      linkedinUrl: p.linkedin_url ?? null,
      phone,
    };
  } catch (e) {
    return { ok: false, reason: "error", error: e instanceof Error ? e.message : "fetch failed" };
  }
}

// Helper: split a full name into first/last.
export function splitName(fullName: string): { first: string; last: string } {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return { first: parts[0], last: "" };
  return { first: parts[0], last: parts.slice(1).join(" ") };
}
