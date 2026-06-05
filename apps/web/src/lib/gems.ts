// The gem economy — Gigify's prepaid campaign currency (the "Clash Royale gems"
// model). Artists buy gems in bundles, then spend them to run outreach
// campaigns. Pricing the EXPENSIVE actions (calls) much higher than the cheap
// ones (emails) keeps every spend margin-positive.
//
// All gem values are tunable constants here. Pure helpers (quote, plan) are
// unit-tested; ledger helpers touch the DB atomically.

import { prisma } from "@gigify/db";

// ── Tunable economy ──
export const GEM_USD = 0.02;        // 1 gem ≈ 2 cents (for displaying pack value)
export const EMAIL_GEMS = 1;        // cost to email one venue
export const CALL_GEMS = 20;        // cost to have Tulio call one venue (~16-20× an email)

export type CampaignChannel = "email" | "call";

export function gemsPerItem(channel: CampaignChannel): number {
  return channel === "call" ? CALL_GEMS : EMAIL_GEMS;
}

// Gem bundles — volume bonus scales with size (the Clash Royale curve).
export const GEM_PACKS: Array<{ usd: number; gems: number; label: string }> = [
  { usd: 5, gems: 250, label: "Starter" },
  { usd: 20, gems: 1_100, label: "Touring" },   // +10% bonus
  { usd: 50, gems: 3_000, label: "Headliner" }, // +20% bonus
  { usd: 100, gems: 6_500, label: "Roadie" },   // +30% bonus
];

// ── Quote ──
export type CampaignQuote = {
  channel: CampaignChannel;
  venueCount: number;
  gemsPerItem: number;
  gemCost: number;
  approxUsd: number;
};

export function quoteCampaign(venueCount: number, channel: CampaignChannel): CampaignQuote {
  const per = gemsPerItem(channel);
  const gemCost = venueCount * per;
  return {
    channel,
    venueCount,
    gemsPerItem: per,
    gemCost,
    approxUsd: Math.round(gemCost * GEM_USD * 100) / 100,
  };
}

// ── Schedule planning (pure) ──
// Spreads a proximity-ranked venue list across days (respecting a per-day cap)
// and rotates email sends across sending subdomains to protect reputation.
export type PlannedItem = {
  venueId: string;
  rank: number;
  dayOffset: number;        // 0 = startDate, 1 = next day, ...
  scheduledFor: Date;
  sendingDomain: string | null;
};

export function planCampaign(opts: {
  rankedVenueIds: string[]; // already ordered best-first (proximity + tier)
  perDayCap: number;
  subdomains: string[];     // email sending subdomains to rotate; [] for calls
  startDate: Date;
}): { items: PlannedItem[]; daysSpread: number } {
  const cap = Math.max(1, opts.perDayCap);
  const items: PlannedItem[] = opts.rankedVenueIds.map((venueId, i) => {
    const dayOffset = Math.floor(i / cap);
    const scheduledFor = new Date(opts.startDate);
    scheduledFor.setDate(scheduledFor.getDate() + dayOffset);
    scheduledFor.setHours(0, 0, 0, 0);
    const sendingDomain =
      opts.subdomains.length > 0 ? opts.subdomains[i % opts.subdomains.length] : null;
    return { venueId, rank: i + 1, dayOffset, scheduledFor, sendingDomain };
  });
  const daysSpread = items.length ? items[items.length - 1].dayOffset + 1 : 0;
  return { items, daysSpread };
}

// Sending subdomains to rotate across, from env (comma-separated), e.g.
// "mail1.elijahstone.com,mail2.elijahstone.com". Falls back to the single
// EMAIL_FROM domain if none configured.
export function sendingSubdomains(): string[] {
  const raw = process.env.SENDING_SUBDOMAINS?.trim();
  if (raw) return raw.split(",").map((s) => s.trim()).filter(Boolean);
  const from = process.env.EMAIL_FROM ?? process.env.RESEND_FROM_EMAIL;
  const domain = from?.includes("@") ? from.split("@")[1] : from;
  return domain ? [domain] : [];
}

// ── Ledger (DB, atomic) ──
export async function getBalance(artistId: string): Promise<number> {
  const a = await prisma.artist.findUnique({ where: { id: artistId }, select: { gemBalance: true } });
  return a?.gemBalance ?? 0;
}

// Spend gems. Returns the new balance, or null if insufficient funds.
export async function debitGems(
  artistId: string,
  amount: number,
  reason: string,
  campaignId?: string
): Promise<number | null> {
  return prisma.$transaction(async (tx) => {
    const a = await tx.artist.findUnique({ where: { id: artistId }, select: { gemBalance: true } });
    const current = a?.gemBalance ?? 0;
    if (current < amount) return null;
    const balanceAfter = current - amount;
    await tx.artist.update({ where: { id: artistId }, data: { gemBalance: balanceAfter } });
    await tx.gemTransaction.create({
      data: { artistId, delta: -amount, balanceAfter, reason, campaignId },
    });
    return balanceAfter;
  });
}

// Add gems (purchase / grant / refund). Returns the new balance.
export async function creditGems(
  artistId: string,
  amount: number,
  reason: string,
  campaignId?: string
): Promise<number> {
  return prisma.$transaction(async (tx) => {
    const a = await tx.artist.findUnique({ where: { id: artistId }, select: { gemBalance: true } });
    const balanceAfter = (a?.gemBalance ?? 0) + amount;
    await tx.artist.update({ where: { id: artistId }, data: { gemBalance: balanceAfter } });
    await tx.gemTransaction.create({
      data: { artistId, delta: amount, balanceAfter, reason, campaignId },
    });
    return balanceAfter;
  });
}
