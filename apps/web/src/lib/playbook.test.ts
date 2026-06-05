import { describe, it, expect } from "vitest";
import { decideStep, DEFAULT_CADENCE, type EngagementSignals } from "./playbook";

function signals(overrides: Partial<EngagementSignals> = {}): EngagementSignals {
  return { optedOut: false, pipelineStage: null, replied: false, opened: false, ...overrides };
}

describe("decideStep", () => {
  it("executes the first step for a fresh, unengaged lead", () => {
    const d = decideStep(0, signals());
    expect(d.type).toBe("execute");
    if (d.type === "execute") expect(d.step.key).toBe("email_1");
  });

  it("stops immediately if opted out", () => {
    expect(decideStep(1, signals({ optedOut: true })).type).toBe("stop");
  });

  it("converts (hands off) when the venue replies", () => {
    const d = decideStep(2, signals({ replied: true }));
    expect(d.type).toBe("convert");
  });

  it("converts when the pipeline shows engagement", () => {
    expect(decideStep(1, signals({ pipelineStage: "INTERESTED" })).type).toBe("convert");
    expect(decideStep(1, signals({ pipelineStage: "BOOKED" })).type).toBe("convert");
  });

  it("stops on a declined/cancelled pipeline", () => {
    expect(decideStep(1, signals({ pipelineStage: "DECLINED" })).type).toBe("stop");
  });

  it("completes when the cadence is exhausted with no engagement", () => {
    expect(decideStep(DEFAULT_CADENCE.length, signals()).type).toBe("complete");
  });

  it("skips a redundant follow-up email if they already opened (but not step 0)", () => {
    const d = decideStep(2, signals({ opened: true })); // step 2 = email_2
    expect(d.type).toBe("skip_to_next");
  });

  it("never skips a call step even if opened", () => {
    const d = decideStep(1, signals({ opened: true })); // step 1 = call_1
    expect(d.type).toBe("execute");
    if (d.type === "execute") expect(d.step.action).toBe("call");
  });

  it("still sends the very first email even if 'opened' is somehow set", () => {
    // step 0 is never skipped by the opened-guard (guard requires stepIndex > 0)
    expect(decideStep(0, signals({ opened: true })).type).toBe("execute");
  });
});
