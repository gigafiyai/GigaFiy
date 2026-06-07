// Central, validated environment config. All env access flows through here so
// it's parsed once, typed, and never read raw + unchecked across the codebase.
// Server-only (reads process.env fully) — do not import from client components.

import { z } from "zod";

// Every known var is optional (most are integration keys); we validate shape,
// not presence. Unknown keys are stripped. Required-for-boot is checked via
// helpers below rather than throwing at import (which would break the build).
const schema = z.object({
  DATABASE_URL: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  NEXT_PUBLIC_APP_URL: z.string().optional(),

  // Email
  RESEND_API_KEY: z.string().optional(),
  SENDGRID_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().optional(),
  RESEND_FROM_EMAIL: z.string().optional(),
  SENDGRID_FROM_EMAIL: z.string().optional(),
  SENDING_SUBDOMAINS: z.string().optional(),

  // Calls (Vapi)
  VAPI_API_KEY: z.string().optional(),
  VAPI_PHONE_NUMBER_ID: z.string().optional(),
  VAPI_WEBHOOK_URL: z.string().optional(),

  // Payments (Stripe)
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),

  // Discovery
  GOOGLE_PLACES_API_KEY: z.string().optional(),
  SETLIST_FM_API_KEY: z.string().optional(),
  FOURSQUARE_API_KEY: z.string().optional(),

  // Enrichment
  HUNTER_API_KEY: z.string().optional(),
  APOLLO_API_KEY: z.string().optional(),
  BOOKING_AGENT_API_KEY: z.string().optional(),

  // Ops
  CRON_SECRET: z.string().optional(),
});

export const env = schema.parse(process.env);

const has = (v?: string) => !!(v && v.trim());

// Integration readiness — powers the system-status panel and lets routes ask
// "is X configured?" without re-reading env.
export function integrationStatus() {
  const emailProvider = has(env.RESEND_API_KEY) ? "resend" : has(env.SENDGRID_API_KEY) ? "sendgrid" : "stub";
  const stripeMode = env.STRIPE_SECRET_KEY?.startsWith("sk_live") ? "live" : has(env.STRIPE_SECRET_KEY) ? "test" : null;
  return {
    database: { configured: has(env.DATABASE_URL) },
    ai: { configured: has(env.ANTHROPIC_API_KEY) },
    email: {
      configured: emailProvider !== "stub",
      provider: emailProvider,
      from: env.EMAIL_FROM ?? env.RESEND_FROM_EMAIL ?? env.SENDGRID_FROM_EMAIL ?? null,
      failover: has(env.RESEND_API_KEY) && has(env.SENDGRID_API_KEY),
    },
    calls: {
      configured: has(env.VAPI_API_KEY) && has(env.VAPI_PHONE_NUMBER_ID),
      webhook: has(env.VAPI_WEBHOOK_URL),
    },
    payments: { configured: has(env.STRIPE_SECRET_KEY), mode: stripeMode, webhook: has(env.STRIPE_WEBHOOK_SECRET) },
    discovery: {
      googlePlaces: has(env.GOOGLE_PLACES_API_KEY),
      setlistFm: has(env.SETLIST_FM_API_KEY),
      foursquare: has(env.FOURSQUARE_API_KEY),
    },
    enrichment: {
      hunter: has(env.HUNTER_API_KEY),
      apollo: has(env.APOLLO_API_KEY),
      bookingAgent: has(env.BOOKING_AGENT_API_KEY),
    },
    cron: { configured: has(env.CRON_SECRET) },
  };
}

export type IntegrationStatus = ReturnType<typeof integrationStatus>;
