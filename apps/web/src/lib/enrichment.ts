// Three-tier venue enrichment.
//   free:    fast fetch + regex (no JS). Zero cost. ~50% hit rate.
//   deep:    headless Chromium for JS-rendered mailto links. Free but slow (~3s/venue).
//   premium: Booking-Agent.io for named contacts. Paid per lookup.
// The orchestrator runs the appropriate tier. Deep is meant to run AFTER free
// has tried and missed — venues that already have an email skip the queue.

import { scrapeVenueContact } from "@/lib/web-scrape";
import { scrapeVenueContactDeep } from "@/lib/web-scrape-deep";
import { enrichVenueContact as bookingAgentLookup } from "@/lib/booking-agent";
import { analyzeVenueNarrative, type VenueAnalysis } from "@/lib/venue-analyzer";
import { findEmailViaHunter } from "@/lib/enrichment-hunter";
import { findOwnerViaApollo, splitName } from "@/lib/enrichment-apollo";
import { scrapeFacebookPage } from "@/lib/scrape-facebook";

export type EnrichmentTier = "free" | "deep" | "premium";

export type EnrichmentInput = {
  venueName: string;
  city: string;
  state: string;
  venueType: string;
  website: string | null;
  facebookUrl?: string | null;
  decisionMakerName?: string | null;
  decisionMakerRole?: string | null;
};

export type EnrichmentOutput = {
  tier: EnrichmentTier;
  source: "web_scrape" | "deep_scrape" | "booking_agent" | "apollo" | "none";
  fieldsAvailable: {
    name?: string;
    email?: string;
    phone?: string;
    title?: string;
    linkedinUrl?: string;
  };
  intelligence?: {
    rawAboutText: string | null;
    instagramHandle: string | null;
    facebookUrl: string | null;
    analysis: VenueAnalysis | null;
    // Facebook-specific signals
    hostsLiveMusicFB?: boolean | null;
    privateEventsFriendly?: boolean;
    pastArtistMentions?: string[];
    fbFollowerCount?: number | null;
  };
  notes?: string;
};

export async function runEnrichment(
  input: EnrichmentInput,
  tier: EnrichmentTier
): Promise<EnrichmentOutput> {
  // Premium first (if requested + configured) — returns richer data.
  if (tier === "premium" && process.env.BOOKING_AGENT_API_KEY) {
    const result = await bookingAgentLookup({
      venueName: input.venueName,
      city: input.city,
      state: input.state,
    });
    if (result.ok) {
      return {
        tier: "premium",
        source: "booking_agent",
        fieldsAvailable: {
          name: result.contact.name,
          email: result.contact.email ?? undefined,
          phone: result.contact.phone ?? undefined,
          title: result.contact.title ?? undefined,
        },
      };
    }
    // Premium missed → fall through to free scrape.
  }

  // Deep: headless browser only. We assume free has already run globally —
  // no fallback to free for the same venue (would just repeat work that
  // already failed at the network-fetch layer).
  if (tier === "deep" && input.website) {
    const deep = await scrapeVenueContactDeep(input.website);
    if (deep.email) {
      return {
        tier: "deep",
        source: "deep_scrape",
        fieldsAvailable: { email: deep.email },
        notes: "Found via headless browser scrape",
      };
    }
    return {
      tier: "deep",
      source: "none",
      fieldsAvailable: {},
      notes: "Deep scrape returned no email",
    };
  }

  // Tier 2.5: Hunter.io domain-search — sits between deep scrape and premium.
  // Runs when a website exists but scraping found nothing. Burns free quota only
  // on confirmed misses, so the 25/month free tier stretches further.
  if (tier === "deep" && input.website && process.env.HUNTER_API_KEY) {
    const hunterResult = await findEmailViaHunter({
      website: input.website,
      venueName: input.venueName,
      apiKey: process.env.HUNTER_API_KEY,
    });
    if (hunterResult.ok) {
      return {
        tier: "deep",
        source: "web_scrape" as const, // reuse enum; label stored separately
        fieldsAvailable: {
          email: hunterResult.email,
          name: [hunterResult.firstName, hunterResult.lastName].filter(Boolean).join(" ") || undefined,
          title: hunterResult.position ?? undefined,
        },
        notes: "Found via Hunter.io domain search",
      };
    }
    if (hunterResult.reason === "quota") {
      console.warn("[hunter] quota reached — skipping remaining Hunter calls");
    }
  }

  // Apollo people-match for named owners — Tier 2.5b.
  // Only runs when: deep tier, we have an owner name but no email, Apollo key set.
  if (tier === "deep" && input.decisionMakerName && process.env.APOLLO_API_KEY) {
    const isOwner = /(owner|founder|proprietor)/i.test(input.decisionMakerRole ?? "");
    if (isOwner) {
      const { first, last } = splitName(input.decisionMakerName);
      if (first && last) {
        const apolloResult = await findOwnerViaApollo({
          firstName: first,
          lastName: last,
          organizationName: input.venueName,
        });
        if (apolloResult.ok) {
          return {
            tier: "deep",
            source: "apollo",
            fieldsAvailable: {
              email: apolloResult.email,
              phone: apolloResult.phone ?? undefined,
              title: apolloResult.title ?? undefined,
              linkedinUrl: apolloResult.linkedinUrl ?? undefined,
            },
            notes: `Apollo people-match (${apolloResult.emailStatus})`,
          };
        }
      }
    }
  }

  // Free: fast fetch + regex + narrative capture.
  if (tier === "free" && input.website) {
    const scraped = await scrapeVenueContact(input.website, input.venueType);

    // The Facebook scrape is CHEAP (1 fetch) and gives the live-music signal we
    // want on EVERY venue (even phone-only ones become call targets). Keep it.
    // The Claude narrative analysis is EXPENSIVE (full LLM call) and is only
    // used to personalize EMAILS — so only run it when we actually found an
    // email. This cuts Claude calls by 60-85% since most venues have none.
    const fbPromise =
      input.facebookUrl || scraped.facebookUrl
        ? scrapeFacebookPage(input.facebookUrl ?? scraped.facebookUrl!)
        : Promise.resolve(null);

    const analysisPromise =
      scraped.email && scraped.narrativeText
        ? analyzeVenueNarrative({
            venueName: input.venueName,
            city: input.city,
            state: input.state,
            venueType: input.venueType,
            rawText: scraped.narrativeText,
          })
        : Promise.resolve(null);

    const [analysis, fbIntel] = await Promise.all([analysisPromise, fbPromise]);

    const intelligence = {
      // Only persist the raw about text when we'll actually use it (have email)
      rawAboutText: scraped.email ? scraped.narrativeText : null,
      instagramHandle: scraped.instagramHandle,
      facebookUrl: scraped.facebookUrl ?? input.facebookUrl ?? null,
      analysis,
      hostsLiveMusicFB: fbIntel?.hostsLiveMusic ?? null,
      privateEventsFriendly: fbIntel?.privateEventsFriendly ?? false,
      pastArtistMentions: fbIntel?.pastArtistMentions ?? [],
      fbFollowerCount: fbIntel?.followerCount ?? null,
    };

    if (scraped.email) {
      return {
        tier: "free",
        source: "web_scrape",
        fieldsAvailable: { email: scraped.email },
        intelligence,
        notes: scraped.source ? `Found on ${scraped.source.replace("_", " ")}` : undefined,
      };
    }
    // No email — still persist the Facebook live-music signal + social handles
    // (used by lead scoring and the call-list, even without an email).
    if (
      intelligence.hostsLiveMusicFB !== null ||
      intelligence.instagramHandle ||
      intelligence.facebookUrl ||
      intelligence.privateEventsFriendly
    ) {
      return {
        tier: "free",
        source: "none",
        fieldsAvailable: {},
        intelligence,
        notes: "No email — captured live-music signal",
      };
    }
  }

  return {
    tier,
    source: "none",
    fieldsAvailable: {},
    notes: !input.website ? "No website on file" : "No contact found",
  };
}
