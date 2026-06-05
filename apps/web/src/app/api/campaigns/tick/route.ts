import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@gigify/db";
import { sendOutreachEmailToVenue } from "@/lib/send-outreach";
import { assembleVenueBrief } from "@/lib/assemble-brief";
import { placeCall, toE164, vapiConfigured } from "@/lib/vapi";
import { isWithinCallingHours, MIN_DAYS_BETWEEN_CALLS } from "@/lib/calling-compliance";
import { processAutopilots } from "@/lib/autopilot";

export const dynamic = "force-dynamic";

// The campaign runner — processes all campaign items that are due (scheduled
// for today or earlier and still pending). Meant to be hit by a daily cron;
// protect it with CRON_SECRET. Each item sends its email (with the assigned
// sending subdomain) or places its Tulio call (with the same compliance gates
// as manual dialing). Idempotent: only ever touches pending items.
//
//   POST /api/campaigns/tick      (header: x-cron-secret: <CRON_SECRET>)
const MAX_PER_TICK = 300; // safety ceiling per invocation

export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("x-cron-secret") !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);

  const due = await prisma.campaignItem.findMany({
    where: { status: "pending", scheduledFor: { lte: endOfToday }, campaign: { status: { in: ["scheduled", "running"] } } },
    orderBy: [{ scheduledFor: "asc" }, { rank: "asc" }],
    take: MAX_PER_TICK,
    include: { campaign: true },
  });

  let sent = 0;
  let failed = 0;
  let skipped = 0;
  const touchedCampaigns = new Set<string>();

  for (const item of due) {
    touchedCampaigns.add(item.campaignId);
    try {
      if (item.campaign.channel === "email") {
        const from = item.sendingDomain ? `booking@${item.sendingDomain}` : undefined;
        const res = await sendOutreachEmailToVenue(item.venueId, { from });
        if (res.ok) {
          await mark(item.id, "sent");
          sent++;
        } else {
          await mark(item.id, "failed", res.error);
          failed++;
        }
      } else {
        // Call channel — same compliance gates as the manual dialer.
        const outcome = await runCallItem(item.venueId);
        if (outcome.ok) { await mark(item.id, "sent"); sent++; }
        else if (outcome.retry) { skipped++; /* leave pending — transient (off-hours / not configured) */ }
        else if (outcome.skip) { await mark(item.id, "skipped", outcome.reason); skipped++; }
        else { await mark(item.id, "failed", outcome.reason); failed++; }
      }
    } catch (e) {
      await mark(item.id, "failed", e instanceof Error ? e.message : "error");
      failed++;
    }
  }

  // Flip campaigns to running, and to completed once nothing is pending.
  for (const campaignId of touchedCampaigns) {
    const remaining = await prisma.campaignItem.count({ where: { campaignId, status: "pending" } });
    await prisma.campaign.update({
      where: { id: campaignId },
      data: remaining === 0 ? { status: "completed", completedAt: new Date() } : { status: "running" },
    });
  }

  // Always-on daily-budget autopilots spend down their remaining budget too.
  const autopilots = await processAutopilots();

  return NextResponse.json({
    ok: true,
    processed: due.length, sent, failed, skipped, campaigns: touchedCampaigns.size,
    autopilots,
  });
}

function mark(id: string, status: string, error?: string) {
  return prisma.campaignItem.update({
    where: { id },
    data: { status, error: error ?? null, sentAt: status === "sent" ? new Date() : null },
  });
}

// Place one Tulio call for a campaign item, applying the same compliance gates
// as /api/calls/dial.
async function runCallItem(
  venueId: string
): Promise<{ ok: boolean; skip?: boolean; retry?: boolean; reason?: string }> {
  // Transient — leave the item pending so a later tick (in business hours,
  // or after keys are set) can try again.
  if (!vapiConfigured()) return { ok: false, retry: true, reason: "calling not configured" };

  const assembled = await assembleVenueBrief(venueId);
  if (!assembled) return { ok: false, reason: "venue not found" };

  const number = toE164(assembled.venue.phone);
  if (!number) return { ok: false, skip: true, reason: "no valid phone" };

  const dnc = await prisma.venue.findUnique({ where: { id: venueId }, select: { optedOut: true } });
  if (dnc?.optedOut) return { ok: false, skip: true, reason: "opted out" };

  const window = isWithinCallingHours(assembled.venue.state);
  if (!window.ok) return { ok: false, retry: true, reason: window.reason ?? "outside calling hours" };

  const since = new Date(Date.now() - MIN_DAYS_BETWEEN_CALLS * 24 * 60 * 60 * 1000);
  const recent = await prisma.call.findFirst({ where: { venueId, calledAt: { gte: since } }, select: { id: true } });
  if (recent) return { ok: false, skip: true, reason: "called recently" };

  const call = await placeCall({ toNumber: number, brief: assembled.brief, metadata: { venueId, artistId: assembled.artistId } });
  if (!call.ok) return { ok: false, reason: call.error };

  await prisma.call.create({
    data: {
      venueId,
      artistId: assembled.artistId,
      vapiCallId: call.callId || null,
      status: "INITIATED",
      calledAt: new Date(),
      scriptVariant: "tulio_campaign",
    },
  });
  return { ok: true };
}
