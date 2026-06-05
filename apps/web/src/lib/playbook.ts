// Playbooks — the ServiceNow transplant. A codified follow-up cadence that
// turns one-shot outreach into relentless, polite, automated persistence
// (most bookings are won on follow-up #2-4, not the first touch).
//
// The default cadence: email → wait → Tulio call → wait → nudge → final nudge.
// Before every step the runner checks whether the venue has already engaged
// (replied / interested / booked) — if so it CONVERTS and hands off to a human
// instead of continuing to pester.

import { prisma } from "@gigify/db";
import { sendOutreachEmailToVenue } from "@/lib/send-outreach";
import { placeCallForVenue } from "@/lib/place-call";

export type StepAction = "email" | "call";

export type PlaybookStep = {
  key: string;
  action: StepAction;
  waitDays: number; // days to wait AFTER this step before the next
  label: string;
};

// The default booking cadence. Tunable; could become per-artist later.
export const DEFAULT_CADENCE: PlaybookStep[] = [
  { key: "email_1", action: "email", waitDays: 2, label: "Intro email" },
  { key: "call_1", action: "call", waitDays: 3, label: "Tulio follow-up call" },
  { key: "email_2", action: "email", waitDays: 4, label: "Nudge email" },
  { key: "email_final", action: "email", waitDays: 0, label: "Final nudge" },
];

// Pipeline stages that mean the venue is engaged — stop pestering, hand off.
const CONVERTED_STAGES = new Set(["INTERESTED", "DEPOSIT", "BOOKED"]);
const STOPPED_STAGES = new Set(["DECLINED", "CANCELLED", "OPTED_OUT"]);

export type EngagementSignals = {
  optedOut: boolean;
  pipelineStage: string | null;
  replied: boolean;   // any outreach marked REPLIED
  opened: boolean;    // any outreach opened/clicked
};

export type StepDecision =
  | { type: "convert"; reason: string }
  | { type: "stop"; reason: string }
  | { type: "complete"; reason: string }
  | { type: "execute"; step: PlaybookStep }
  | { type: "skip_to_next"; reason: string }; // step not applicable, advance without acting

// Pure decision: given where the enrollment is + engagement signals, what should
// happen at this tick? No DB, fully unit-tested.
export function decideStep(
  stepIndex: number,
  signals: EngagementSignals,
  cadence: PlaybookStep[] = DEFAULT_CADENCE
): StepDecision {
  if (signals.optedOut) return { type: "stop", reason: "opted out / do-not-contact" };
  if (signals.pipelineStage && STOPPED_STAGES.has(signals.pipelineStage)) {
    return { type: "stop", reason: `pipeline ${signals.pipelineStage.toLowerCase()}` };
  }
  if (signals.replied) return { type: "convert", reason: "venue replied — hand off to human" };
  if (signals.pipelineStage && CONVERTED_STAGES.has(signals.pipelineStage)) {
    return { type: "convert", reason: `engaged (${signals.pipelineStage.toLowerCase()})` };
  }
  if (stepIndex >= cadence.length) return { type: "complete", reason: "cadence exhausted — no engagement" };

  const step = cadence[stepIndex];
  // If they've already opened/clicked, skip a redundant nudge email and let the
  // call (or next step) do the work — but never skip a call step.
  if (step.action === "email" && stepIndex > 0 && signals.opened) {
    return { type: "skip_to_next", reason: "already opened — skipping redundant email" };
  }
  return { type: "execute", step };
}

function addDays(d: Date, days: number): Date {
  const n = new Date(d);
  n.setDate(n.getDate() + days);
  return n;
}

export type PlaybookRunResult = { advanced: number; converted: number; stopped: number; completed: number; executed: number };

// Process all due enrollments once (called from the tick runner).
export async function processPlaybooks(now: Date = new Date()): Promise<PlaybookRunResult> {
  const due = await prisma.playbookEnrollment.findMany({
    where: { status: "active", nextActionAt: { lte: now } },
    take: 300,
  });

  const res: PlaybookRunResult = { advanced: 0, converted: 0, stopped: 0, completed: 0, executed: 0 };

  for (const e of due) {
    // Gather engagement signals.
    const venue = await prisma.venue.findUnique({
      where: { id: e.venueId },
      select: { optedOut: true, pipeline: { select: { stage: true } } },
    });
    const replied = await prisma.outreach.count({ where: { venueId: e.venueId, status: "REPLIED" } });
    const opened = await prisma.outreach.count({
      where: { venueId: e.venueId, OR: [{ openedAt: { not: null } }, { clickedAt: { not: null } }] },
    });

    const decision = decideStep(e.stepIndex, {
      optedOut: venue?.optedOut ?? false,
      pipelineStage: venue?.pipeline?.stage ?? null,
      replied: replied > 0,
      opened: opened > 0,
    });

    if (decision.type === "convert" || decision.type === "stop" || decision.type === "complete") {
      const status = decision.type === "convert" ? "converted" : decision.type === "stop" ? "stopped" : "completed";
      await prisma.playbookEnrollment.update({
        where: { id: e.id },
        data: { status, lastReason: decision.reason },
      });
      res[decision.type === "convert" ? "converted" : decision.type === "stop" ? "stopped" : "completed"]++;
      continue;
    }

    if (decision.type === "skip_to_next") {
      const nextIndex = e.stepIndex + 1;
      await prisma.playbookEnrollment.update({
        where: { id: e.id },
        data: { stepIndex: nextIndex, nextActionAt: now, lastReason: decision.reason },
      });
      res.advanced++;
      continue;
    }

    // Execute the step.
    const step = decision.step;
    let ok = false;
    let reason = "";
    if (step.action === "email") {
      const r = await sendOutreachEmailToVenue(e.venueId);
      ok = r.ok;
      reason = r.error ?? `emailed (${r.mode})`;
    } else {
      const r = await placeCallForVenue(e.venueId, { scriptVariant: `playbook_${step.key}` });
      if (r.retry) {
        // Transient (off-hours / not configured) — try again next tick, don't advance.
        await prisma.playbookEnrollment.update({ where: { id: e.id }, data: { lastReason: r.reason ?? "retry" } });
        continue;
      }
      ok = r.ok;
      reason = r.reason ?? (r.ok ? "called" : "call failed");
    }

    const nextIndex = e.stepIndex + 1;
    const done = nextIndex >= DEFAULT_CADENCE.length;
    await prisma.playbookEnrollment.update({
      where: { id: e.id },
      data: {
        stepIndex: nextIndex,
        nextActionAt: addDays(now, step.waitDays),
        lastActionAt: now,
        lastReason: `${step.label}: ${reason}`,
        status: done ? "completed" : "active",
      },
    });
    res.executed++;
    if (ok) res.advanced++;
    if (done) res.completed++;
  }

  return res;
}
