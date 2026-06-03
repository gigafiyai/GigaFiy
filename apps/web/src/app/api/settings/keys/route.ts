import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const KEYS = [
  { key: "ANTHROPIC_API_KEY", label: "Anthropic (Claude)", purpose: "Email generation, insights" },
  { key: "SENDGRID_API_KEY", label: "SendGrid", purpose: "Email delivery + tracking. Event webhook: /api/sendgrid/events" },
  { key: "TWILIO_ACCOUNT_SID", label: "Twilio SID", purpose: "Voice calls (Nova)" },
  { key: "TWILIO_AUTH_TOKEN", label: "Twilio Auth Token", purpose: "Voice calls (Nova)" },
  { key: "TWILIO_PHONE_NUMBER", label: "Twilio Phone Number", purpose: "Caller ID for Nova" },
  { key: "STRIPE_SECRET_KEY", label: "Stripe Secret", purpose: "Deposits + refunds" },
  { key: "STRIPE_PUBLISHABLE_KEY", label: "Stripe Publishable", purpose: "Checkout client" },
  { key: "STRIPE_WEBHOOK_SECRET", label: "Stripe Webhook Secret", purpose: "Payment events" },
  { key: "GOOGLE_PLACES_API_KEY", label: "Google Places", purpose: "Venue discovery (Wave 0)" },
  { key: "SETLIST_FM_API_KEY", label: "Setlist.fm", purpose: "Venue discovery: known live-music rooms (Wave 1)" },
  { key: "FOURSQUARE_API_KEY", label: "Foursquare Places", purpose: "Venue discovery: 5K free calls/day, different index (Wave 2)" },
  { key: "HUNTER_API_KEY", label: "Hunter.io", purpose: "Email enrichment: domain-search for missed contacts (Wave 2)" },
  { key: "ELEVENLABS_API_KEY", label: "ElevenLabs", purpose: "Nova voice synthesis" },
  { key: "ELEVENLABS_VOICE_ID", label: "ElevenLabs Voice ID", purpose: "Nova voice ID" },
  { key: "DEEPGRAM_API_KEY", label: "Deepgram", purpose: "Call transcription" },
  { key: "BOOKING_AGENT_API_KEY", label: "Booking-Agent.io", purpose: "Premium tier — named talent buyers for music venues (best for A-grade gaps)" },
  { key: "APOLLO_API_KEY", label: "Apollo.io", purpose: "Owner personal email lookup — 50 free credits/month" },
];

export async function GET() {
  const result = KEYS.map(({ key, label, purpose }) => ({
    key,
    label,
    purpose,
    set: !!process.env[key],
  }));
  return NextResponse.json(result);
}
