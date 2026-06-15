import { describe, it, expect } from "vitest";
import { deriveAction, CADENCE, type WorklistInput } from "./worklist-engine";

const NOW = new Date("2026-06-15T12:00:00Z").getTime();
const DAY = 86_400_000;
const daysAgo = (n: number) => new Date(NOW - n * DAY);
const inDays = (n: number) => new Date(NOW + n * DAY);

function base(overrides: Partial<WorklistInput> = {}): WorklistInput {
  return {
    canCall: true,
    canEmail: true,
    leadTier: "B",
    leadScore: 60,
    daysUntilShow: 20,
    lastCall: null,
    lastOutreach: null,
    pipelineStage: "QUEUED",
    snoozedUntil: null,
    dismissedAt: null,
    ...overrides,
  };
}

describe("deriveAction", () => {
  it("a never-contacted lead is NEW and due now", () => {
    const a = deriveAction(base({ lastCall: null, lastOutreach: null }), NOW);
    expect(a.kind).toBe("NEW");
    expect(a.due).toBe(true);
    expect(a.channel).toBe("CALL"); // prefers call when a number exists
  });

  it("falls back to EMAIL when there is no phone", () => {
    const a = deriveAction(base({ canCall: false }), NOW);
    expect(a.channel).toBe("EMAIL");
  });

  it("a reply jumps to WARM, due now, highest urgency", () => {
    const a = deriveAction(base({ lastOutreach: { status: "REPLIED", sentAt: daysAgo(1) } }), NOW);
    expect(a.kind).toBe("WARM");
    expect(a.due).toBe(true);
    const newLead = deriveAction(base(), NOW);
    expect(a.urgency).toBeGreaterThan(newLead.urgency);
  });

  it("a fresh email is WAITING, not yet due", () => {
    const a = deriveAction(base({ lastOutreach: { status: "SENT", sentAt: daysAgo(1) } }), NOW);
    expect(a.kind).toBe("WAITING");
    expect(a.due).toBe(false);
  });

  it("an aged unanswered email becomes a due FOLLOW_UP", () => {
    const a = deriveAction(
      base({ lastOutreach: { status: "SENT", sentAt: daysAgo(CADENCE.emailFollowUpDays + 1) } }),
      NOW
    );
    expect(a.kind).toBe("FOLLOW_UP");
    expect(a.due).toBe(true);
    expect(a.channel).toBe("CALL"); // prefers calling the follow-up when possible
  });

  it("a recent voicemail waits, then becomes a retry", () => {
    const recent = deriveAction(base({ lastCall: { status: "VOICEMAIL", callTier: null, calledAt: daysAgo(1) } }), NOW);
    expect(recent.kind).toBe("WAITING");
    const aged = deriveAction(
      base({ lastCall: { status: "VOICEMAIL", callTier: null, calledAt: daysAgo(CADENCE.callRetryDays + 1) } }),
      NOW
    );
    expect(aged.kind).toBe("FOLLOW_UP");
    expect(aged.due).toBe(true);
    expect(aged.label).toMatch(/again/i);
  });

  it("a strong answered call circles back after the warm window", () => {
    const recent = deriveAction(base({ lastCall: { status: "ANSWERED", callTier: "A", calledAt: daysAgo(1) } }), NOW);
    expect(recent.kind).toBe("WAITING");
    const due = deriveAction(
      base({ lastCall: { status: "ANSWERED", callTier: "A", calledAt: daysAgo(CADENCE.warmCircleBackDays + 1) } }),
      NOW
    );
    expect(due.kind).toBe("WARM");
    expect(due.due).toBe(true);
  });

  it("a low-interest answered call gets a long revisit", () => {
    const recent = deriveAction(base({ lastCall: { status: "ANSWERED", callTier: "D", calledAt: daysAgo(3) } }), NOW);
    expect(recent.kind).toBe("WAITING");
    const due = deriveAction(
      base({ lastCall: { status: "ANSWERED", callTier: "D", calledAt: daysAgo(CADENCE.coldRevisitDays + 1) } }),
      NOW
    );
    expect(due.kind).toBe("FOLLOW_UP");
  });

  it("snoozed leads stay off the Today feed until the snooze expires", () => {
    const snoozed = deriveAction(base({ snoozedUntil: inDays(3) }), NOW);
    expect(snoozed.kind).toBe("SNOOZED");
    expect(snoozed.due).toBe(false);
    // expired snooze falls through to normal rules
    const expired = deriveAction(base({ snoozedUntil: daysAgo(1) }), NOW);
    expect(expired.kind).toBe("NEW");
  });

  it("dismissed and terminal-pipeline leads drop off (DONE)", () => {
    expect(deriveAction(base({ dismissedAt: daysAgo(1) }), NOW).kind).toBe("DONE");
    expect(deriveAction(base({ pipelineStage: "BOOKED" }), NOW).kind).toBe("DONE");
    expect(deriveAction(base({ pipelineStage: "DECLINED" }), NOW).kind).toBe("DONE");
  });

  it("a lead with no phone and no email is DONE (unactionable)", () => {
    const a = deriveAction(base({ canCall: false, canEmail: false }), NOW);
    expect(a.kind).toBe("DONE");
  });

  it("imminent-show leads outrank distant-show leads", () => {
    const soon = deriveAction(base({ daysUntilShow: 7 }), NOW);
    const later = deriveAction(base({ daysUntilShow: 90 }), NOW);
    expect(soon.urgency).toBeGreaterThan(later.urgency);
  });
});
