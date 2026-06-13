import { describe, it, expect } from "vitest";
import { callBasis, isWarmOrBetter } from "./call-eligibility";

describe("callBasis", () => {
  it("returns consent when explicit permission is captured", () => {
    expect(callBasis({ callConsent: true, replied: false, pipelineStage: null })).toBe("consent");
  });
  it("returns warm when the venue has replied", () => {
    expect(callBasis({ callConsent: false, replied: true, pipelineStage: "QUEUED" })).toBe("warm");
  });
  it("returns warm when engaged in the pipeline", () => {
    expect(callBasis({ callConsent: false, replied: false, pipelineStage: "INTERESTED" })).toBe("warm");
    expect(callBasis({ callConsent: false, replied: false, pipelineStage: "BOOKED" })).toBe("warm");
  });
  it("returns cold with no interaction", () => {
    expect(callBasis({ callConsent: false, replied: false, pipelineStage: "QUEUED" })).toBe("cold");
    expect(callBasis({ callConsent: false, replied: false, pipelineStage: null })).toBe("cold");
  });
  it("isWarmOrBetter excludes cold only", () => {
    expect(isWarmOrBetter("consent")).toBe(true);
    expect(isWarmOrBetter("warm")).toBe(true);
    expect(isWarmOrBetter("cold")).toBe(false);
  });
});
