// "Always-on" daily-budget outreach (the Meta-Ads model). Each tick, an active
// autopilot spends down its remaining daily gem budget on the best-ranked
// eligible leads — pacing the spend evenly across the business day rather than
// blowing it all in the first run.

import { prisma } from "@gigify/db";
import { gemsPerItem, debitGems, creditGems, type CampaignChannel } from "@/lib/gems";
import { outreachPriority, daysUntil } from "@/lib/lead-ranking";
import { assembleVenueBrief } from "@/lib/assemble-brief";
import { placeCall, toE164, vapiConfigured } from "@/lib/vapi";
import { isWithinCallingHours, MIN_DAYS_BETWEEN_CALLS } from "@/lib/calling-compliance";

// Calling/sending window (local hours). Used to pace the daily budget.
export const WINDOW_START = 8;
export const WINDOW_END = 21;

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

// Whole business-window hours left from `now` (clamped to [0, window length]).
export function businessHoursLeft(now: Date = new Date()): number {
  const h = now.getHours();
  if (h >= WINDOW_END) return 0;
  if (h < WINDOW_START) return WINDOW_END - WINDOW_START;
  return WINDOW_END - h;
}

// How many items to do THIS tick so the remaining day-budget is spread evenly
// across the remaining business hours. In the last hour, finish whatever's left.
export function pacePerTick(remainingItems: number, hoursLeft: number): number {
  if (remainingItems <= 0) return 0;
  if (hoursLeft <= 1) return remainingItems;
  return Math.ceil(remainingItems / hoursLeft);
}

// Gems spent by an autopilot since midnight (positive number).
async function spentToday(autopilotId: string): Promise<number> {
  const rows = await prisma.gemTransaction.findMany({
    where: { autopilotId, createdAt: { gte: startOfToday() } },
    select: { delta: true },
  });
  return rows.reduce((s, r) => s + Math.max(0, -r.delta), 0);
}

const TIER_ORDER = ["D", "C", "B", "A"]; // index = strength
function tierMeets(tier: string | null, min: string | null | undefined): boolean {
  if (!min) return true;
  return TIER_ORDER.indexOf(tier ?? "D") >= TIER_ORDER.indexOf(min);
}

export type AutopilotRunResult = {
  autopilotId: string;
  channel: CampaignChannel;
  placed: number;
  gemsSpent: number;
  stoppedBecause: "budget" | "balance" | "no_leads" | "paused" | "not_configured";
};

// Process every active autopilot once. Returns a per-autopilot summary.
export async function processAutopilots(now: Date = new Date()): Promise<AutopilotRunResult[]> {
  const autos = await prisma.autopilot.findMany({ where: { status: "active" }, include: { artist: true } });
  const results: AutopilotRunResult[] = [];

  for (const auto of autos) {
    const channel = (auto.channel === "email" ? "email" : "call") as CampaignChannel;
    const perItem = gemsPerItem(channel);

    const spent = await spentToday(auto.id);
    const dayRemainingGems = Math.max(0, auto.dailyGemBudget - spent);
    const balance = auto.artist.gemBalance;

    // Items we could still afford today (limited by both daily budget and balance).
    const affordableGems = Math.min(dayRemainingGems, balance);
    const maxItemsToday = Math.floor(affordableGems / perItem);
    if (maxItemsToday <= 0) {
      results.push({
        autopilotId: auto.id, channel, placed: 0, gemsSpent: 0,
        stoppedBecause: dayRemainingGems <= 0 ? "budget" : "balance",
      });
      continue;
    }

    const thisTick = pacePerTick(maxItemsToday, businessHoursLeft(now));

    if (channel === "call" && !vapiConfigured()) {
      results.push({ autopilotId: auto.id, channel, placed: 0, gemsSpent: 0, stoppedBecause: "not_configured" });
      continue;
    }

    const placed = await runCallsForAutopilot(auto.id, auto.artistId, auto.minLeadTier, thisTick);
    results.push({
      autopilotId: auto.id,
      channel,
      placed,
      gemsSpent: placed * perItem,
      stoppedBecause: placed < thisTick ? "no_leads" : "budget",
    });
  }

  return results;
}

// Pick the best eligible call leads and dial up to `limit`, charging gems.
async function runCallsForAutopilot(
  autopilotId: string,
  artistId: string,
  minTier: string | null,
  limit: number
): Promise<number> {
  if (limit <= 0) return 0;

  const since = new Date(Date.now() - MIN_DAYS_BETWEEN_CALLS * 24 * 60 * 60 * 1000);
  // Eligible: has phone, not opted out, not called within the frequency window.
  const venues = await prisma.venue.findMany({
    where: {
      artistId,
      optedOut: false,
      phone: { not: null },
      calls: { none: { calledAt: { gte: since } } },
    },
    select: { id: true, leadScore: true, leadTier: true, state: true, nearestShow: { select: { date: true } } },
  });

  const now = Date.now();
  const ranked = venues
    .filter((v) => tierMeets(v.leadTier, minTier))
    .map((v) => ({
      id: v.id,
      state: v.state,
      priority: outreachPriority({ leadScore: v.leadScore, leadTier: v.leadTier, daysUntilShow: daysUntil(v.nearestShow?.date, now) }),
    }))
    .sort((a, b) => b.priority - a.priority);

  let placed = 0;
  for (const v of ranked) {
    if (placed >= limit) break;
    // Per-venue calling-hours guard (skip, try again a later tick).
    if (!isWithinCallingHours(v.state).ok) continue;

    const assembled = await assembleVenueBrief(v.id);
    if (!assembled) continue;
    const number = toE164(assembled.venue.phone);
    if (!number) continue;

    // Charge the gem first; if the artist ran dry mid-run, stop.
    const debited = await debitGems(artistId, gemsPerItem("call"), "autopilot", { autopilotId });
    if (debited === null) break;

    const call = await placeCall({ toNumber: number, brief: assembled.brief, metadata: { venueId: v.id, artistId } });
    if (!call.ok) {
      // Refund the gem on a failed dial — they didn't get the call.
      await creditGems(artistId, gemsPerItem("call"), "autopilot_refund", { autopilotId });
      continue;
    }

    await prisma.call.create({
      data: { venueId: v.id, artistId, vapiCallId: call.callId || null, status: "INITIATED", calledAt: new Date(), scriptVariant: "tulio_autopilot" },
    });
    placed++;
  }

  return placed;
}
