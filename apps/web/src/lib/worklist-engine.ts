// The self-refreshing worklist engine.
//
// Given everything we know about a venue's contact history, this derives the
// ONE next action the artist should take and WHEN it's due. This is what turns
// the worklist from a one-time cheat sheet into a system of record: contacted
// leads come back at the right time, replies jump the queue, and snoozed/dead
// leads drop out.
//
// Pure + deterministic (now is injected) so it's unit-tested without a DB.

export type WorklistChannel = "CALL" | "EMAIL";

// NEW       — never contacted, ready now
// WARM      — replied or had a good call; act now, top priority
// FOLLOW_UP — contacted a while ago, no resolution; time to nudge
// WAITING   — contacted recently; give it time (not actionable yet)
// SNOOZED   — artist pushed it to a later date
// DONE       — booked, declined, dismissed, or opted out; off the worklist
export type WorklistKind = "NEW" | "WARM" | "FOLLOW_UP" | "WAITING" | "SNOOZED" | "DONE";

export type WorklistInput = {
  canCall: boolean;
  canEmail: boolean;
  leadTier: string | null;
  leadScore: number | null;
  daysUntilShow: number | null;
  lastCall: { status: string; callTier: string | null; calledAt: Date | null } | null;
  lastOutreach: { status: string; sentAt: Date | null } | null;
  pipelineStage: string | null;
  snoozedUntil: Date | null;
  dismissedAt: Date | null;
};

export type WorklistAction = {
  kind: WorklistKind;
  channel: WorklistChannel | null;
  label: string; // short imperative, e.g. "Call", "Follow up on email"
  reason: string; // why now, e.g. "Emailed 5 days ago — no reply"
  dueAt: number; // ms epoch the action becomes actionable
  due: boolean; // actionable right now (in the Today feed)
  urgency: number; // sort key, higher first
};

const DAY = 86_400_000;

// Cadence — how long before a contacted lead resurfaces.
export const CADENCE = {
  emailFollowUpDays: 4, // emailed, no reply → nudge
  callRetryDays: 2, // voicemail / no answer → try again
  warmCircleBackDays: 4, // good call, no booking yet → circle back
  coldRevisitDays: 14, // answered but low-interest → revisit later
};

const TIER_RANK: Record<string, number> = { A: 4, B: 3, C: 2, D: 1 };
const DONE_STAGES = new Set(["DEPOSIT", "BOOKED", "DECLINED", "CANCELLED"]);

function daysAgo(d: Date | null, now: number): number | null {
  return d ? (now - d.getTime()) / DAY : null;
}

// Proximity bonus: leads near an imminent show are more urgent.
function proximityBonus(daysUntilShow: number | null): number {
  if (daysUntilShow == null || daysUntilShow < 0) return 0;
  if (daysUntilShow <= 14) return 30;
  if (daysUntilShow <= 30) return 18;
  if (daysUntilShow <= 60) return 8;
  return 0;
}

function preferredChannel(i: WorklistInput): WorklistChannel | null {
  if (i.canCall) return "CALL";
  if (i.canEmail) return "EMAIL";
  return null;
}

export function deriveAction(i: WorklistInput, now: number = Date.now()): WorklistAction {
  const base =
    (i.leadScore ?? 0) +
    (TIER_RANK[i.leadTier ?? "D"] ?? 1) * 6 +
    proximityBonus(i.daysUntilShow);

  const done = (reason: string): WorklistAction => ({
    kind: "DONE", channel: null, label: "", reason, dueAt: now, due: false, urgency: -1,
  });

  // 1. Terminal — off the worklist entirely.
  if (i.dismissedAt) return done("Removed from worklist");
  if (i.pipelineStage && DONE_STAGES.has(i.pipelineStage)) return done(`Pipeline: ${i.pipelineStage.toLowerCase()}`);

  // 2. Snoozed — comes back when the snooze expires.
  if (i.snoozedUntil && i.snoozedUntil.getTime() > now) {
    return {
      kind: "SNOOZED", channel: preferredChannel(i), label: "Snoozed",
      reason: `Snoozed until ${i.snoozedUntil.toISOString().slice(0, 10)}`,
      dueAt: i.snoozedUntil.getTime(), due: false, urgency: base,
    };
  }

  // 3. Replied to an email → hottest possible signal, act immediately.
  if (i.lastOutreach?.status === "REPLIED") {
    return {
      kind: "WARM", channel: "EMAIL", label: "Reply received — respond",
      reason: "They replied to your email", dueAt: now, due: true, urgency: base + 1000,
    };
  }

  // 4. A good live call (answered, A/B) → circle back to close.
  if (i.lastCall?.status === "ANSWERED" && (i.lastCall.callTier === "A" || i.lastCall.callTier === "B")) {
    const dueAt = (i.lastCall.calledAt?.getTime() ?? now) + CADENCE.warmCircleBackDays * DAY;
    const due = dueAt <= now;
    return {
      kind: due ? "WARM" : "WAITING", channel: preferredChannel(i), label: "Circle back",
      reason: `Strong call ${fmtAgo(daysAgo(i.lastCall.calledAt, now))} — follow through`,
      dueAt, due, urgency: base + (due ? 800 : 0),
    };
  }

  // 5. Voicemail / no answer → retry the call.
  if (i.lastCall && (i.lastCall.status === "VOICEMAIL" || i.lastCall.status === "NO_ANSWER")) {
    const dueAt = (i.lastCall.calledAt?.getTime() ?? now) + CADENCE.callRetryDays * DAY;
    const due = dueAt <= now;
    return {
      kind: due ? "FOLLOW_UP" : "WAITING", channel: i.canCall ? "CALL" : preferredChannel(i),
      label: "Try calling again",
      reason: i.lastCall.status === "VOICEMAIL" ? "Left a voicemail — no callback" : "No answer last time",
      dueAt, due, urgency: base + (due ? 400 : 0),
    };
  }

  // 6. Answered but low interest (C/D) → long revisit.
  if (i.lastCall?.status === "ANSWERED") {
    const dueAt = (i.lastCall.calledAt?.getTime() ?? now) + CADENCE.coldRevisitDays * DAY;
    const due = dueAt <= now;
    return {
      kind: due ? "FOLLOW_UP" : "WAITING", channel: preferredChannel(i), label: "Revisit",
      reason: `Spoke ${fmtAgo(daysAgo(i.lastCall.calledAt, now))} — worth another try`,
      dueAt, due, urgency: base + (due ? 150 : 0),
    };
  }

  // 7. Emailed, no reply yet → follow up (prefer a call if we have a number).
  if (i.lastOutreach && (i.lastOutreach.status === "SENT" || i.lastOutreach.status === "OPENED")) {
    const dueAt = (i.lastOutreach.sentAt?.getTime() ?? now) + CADENCE.emailFollowUpDays * DAY;
    const due = dueAt <= now;
    const opened = i.lastOutreach.status === "OPENED";
    return {
      kind: due ? "FOLLOW_UP" : "WAITING", channel: i.canCall ? "CALL" : "EMAIL",
      label: i.canCall ? "Follow up with a call" : "Follow up on email",
      reason: opened ? "Opened your email — no reply yet" : `Emailed ${fmtAgo(daysAgo(i.lastOutreach.sentAt, now))} — no reply`,
      dueAt, due, urgency: base + (due ? 300 : 0) + (opened ? 50 : 0),
    };
  }

  // 8. Never contacted → new lead, ready now.
  const channel = preferredChannel(i);
  if (!channel) return done("No phone or email on file");
  return {
    kind: "NEW", channel, label: channel === "CALL" ? "Call" : "Email",
    reason: "Not contacted yet",
    dueAt: now, due: true, urgency: base,
  };
}

function fmtAgo(days: number | null): string {
  if (days == null) return "recently";
  const d = Math.round(days);
  if (d <= 0) return "today";
  if (d === 1) return "yesterday";
  return `${d} days ago`;
}
