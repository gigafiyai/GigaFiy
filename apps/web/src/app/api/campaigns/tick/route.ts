import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@gigify/db";
import { sendOutreachEmailToVenue } from "@/lib/send-outreach";
import { placeCallForVenue } from "@/lib/place-call";
import { processAutopilots } from "@/lib/autopilot";
import { processPlaybooks } from "@/lib/playbook";

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
        const outcome = await placeCallForVenue(item.venueId, { scriptVariant: "tulio_campaign" });
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
  // Advance multi-step follow-up cadences (Playbooks).
  const playbooks = await processPlaybooks();

  return NextResponse.json({
    ok: true,
    processed: due.length, sent, failed, skipped, campaigns: touchedCampaigns.size,
    autopilots,
    playbooks,
  });
}

function mark(id: string, status: string, error?: string) {
  return prisma.campaignItem.update({
    where: { id },
    data: { status, error: error ?? null, sentAt: status === "sent" ? new Date() : null },
  });
}
