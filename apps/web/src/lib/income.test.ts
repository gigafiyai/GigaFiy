import { describe, it, expect } from "vitest";
import { weightedPipelineValue, stageProbability, summarizeIncome } from "./income";

describe("stageProbability", () => {
  it("weights later stages higher and terminal stages at zero", () => {
    expect(stageProbability("QUEUED")).toBeLessThan(stageProbability("INTERESTED"));
    expect(stageProbability("DEPOSIT")).toBeGreaterThan(stageProbability("INTERESTED"));
    expect(stageProbability("BOOKED")).toBe(1);
    expect(stageProbability("DECLINED")).toBe(0);
    expect(stageProbability(null)).toBe(0);
  });
});

describe("weightedPipelineValue", () => {
  it("sums probability × expected fee across leads", () => {
    const leads = [{ stage: "INTERESTED" }, { stage: "DEPOSIT" }, { stage: "DECLINED" }];
    // 0.35*400 + 0.90*400 + 0*400 = 140 + 360 + 0 = 500
    expect(weightedPipelineValue(leads, 400)).toBe(500);
  });

  it("is zero with no leads", () => {
    expect(weightedPipelineValue([], 400)).toBe(0);
  });
});

describe("summarizeIncome", () => {
  it("rolls up earned, booked, deposits, and a weighted forecast", () => {
    const s = summarizeIncome({
      completedRevenue: 1200,
      confirmedUpcomingFees: 2000,
      upcomingCount: 5,
      depositsCollected: 600,
      pipelineLeads: [{ stage: "INTERESTED" }, { stage: "BOOKED" }],
      avgFee: 400,
    });
    expect(s.earnedToDate).toBe(1200);
    expect(s.bookedUpcoming).toBe(2000);
    expect(s.depositsCollected).toBe(600);
    // pipeline: 0.35*400 + 1.0*400 = 540
    expect(s.pipelineValue).toBe(540);
    expect(s.projectedTotal).toBe(2540);
  });
});
