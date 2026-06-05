// The engine tick — executes everything that's due: scheduled campaign items
// (email or Tulio call), always-on autopilots, and follow-up playbooks. Shared
// by the cron endpoint (/api/campaigns/tick) and the in-app "Run engine now"
// button (/api/campaigns/run-now).

import { prisma } from "@gigify/db";
import { sendOutreachEmailToVenue } from "@/lib/send-outreach";
import { placeCallForVenue } from "@/lib/place-call";
import { processAutopilots } from "@/lib/autopilot";
import { processPlaybooks } from "@/lib/playbook";

const MAX_PER_TICK = 300; // safety ceiling per invocation

function mark(id: string, status: string, error?: string) {
  return prisma.campaignItem.update({
    where: { id },
    data: { status, error: error ?? null, sentAt: status === "sent" ? new Date() : null },
  });
}

export async function runTick() {
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);

  const due = await prisma.campaignItem.findMany({
    where: { status: "pending", scheduledFor: { lte: endOfToday }, campaign: { status: { in: ["scheduled", "running"] } } },
    orderBy: [{ scheduledFor: "asc" }, { rank: "asc" }],
    take: MAX_PER_TICK,
    include: { campaign: true },
  });

  let sent = 0, failed = 0, skipped = 0;
  const touchedCampaigns = new Set<string>();

  for (const item of due) {
    touchedCampaigns.add(item.campaignId);
    try {
      if (item.campaign.channel === "email") {
        const from = item.sendingDomain ? `booking@${item.sendingDomain}` : undefined;
        const res = await sendOutreachEmailToVenue(item.venueId, { from });
        if (res.ok) { await mark(item.id, "sent"); sent++; }
        else { await mark(item.id, "failed", res.error); failed++; }
      } else {
        const outcome = await placeCallForVenue(item.venueId, { scriptVariant: "tulio_campaign" });
        if (outcome.ok) { await mark(item.id, "sent"); sent++; }
        else if (outcome.retry) { skipped++; /* leave pending — transient */ }
        else if (outcome.skip) { await mark(item.id, "skipped", outcome.reason); skipped++; }
        else { await mark(item.id, "failed", outcome.reason); failed++; }
      }
    } catch (e) {
      await mark(item.id, "failed", e instanceof Error ? e.message : "error");
      failed++;
    }
  }

  for (const campaignId of touchedCampaigns) {
    const remaining = await prisma.campaignItem.count({ where: { campaignId, status: "pending" } });
    await prisma.campaign.update({
      where: { id: campaignId },
      data: remaining === 0 ? { status: "completed", completedAt: new Date() } : { status: "running" },
    });
  }

  const autopilots = await processAutopilots();
  const playbooks = await processPlaybooks();

  return { ok: true, processed: due.length, sent, failed, skipped, campaigns: touchedCampaigns.size, autopilots, playbooks };
}
