import { describe, it, expect } from "vitest";
import { buildAgreement, gigifyFee, depositAmount, GIGIFY_FEE_MIN_USD } from "./agreement";

describe("gigifyFee", () => {
  it("is a percentage of the gig fee above the floor", () => {
    expect(gigifyFee(1000)).toBe(50); // 5% of 1000
  });
  it("never drops below the minimum floor", () => {
    expect(gigifyFee(100)).toBe(GIGIFY_FEE_MIN_USD); // 5% = 5, floored to min
    expect(gigifyFee(0)).toBe(GIGIFY_FEE_MIN_USD);
    expect(gigifyFee(null)).toBe(GIGIFY_FEE_MIN_USD);
  });
});

describe("depositAmount", () => {
  it("is 50% of the gig fee", () => {
    expect(depositAmount(400)).toBe(200);
    expect(depositAmount(null)).toBe(0);
  });
});

describe("buildAgreement", () => {
  it("includes parties, engagement, cancellation, and the booking fee", () => {
    const a = buildAgreement({
      artistName: "Elijah Stone", venueName: "The Sinclair", venueCity: "Cambridge, MA",
      date: "2026-08-14", startTime: "8:00 PM", gigFee: 400, settleMethod: "deposit",
    });
    expect(a.terms.some((t) => t.includes("Elijah Stone") && t.includes("The Sinclair"))).toBe(true);
    expect(a.terms.some((t) => t.toLowerCase().includes("cancel"))).toBe(true);
    expect(a.terms.some((t) => t.toLowerCase().includes("booking fee"))).toBe(true);
    expect(a.depositAmount).toBe(200);
    expect(a.gigifyFee).toBe(20); // 5% of 400
  });

  it("reflects the cash settle method in the terms", () => {
    const deposit = buildAgreement({ artistName: "A", venueName: "V", date: "2026-08-14", gigFee: 400, settleMethod: "deposit" });
    const cash = buildAgreement({ artistName: "A", venueName: "V", date: "2026-08-14", gigFee: 400, settleMethod: "cash" });
    expect(deposit.terms.join(" ")).toMatch(/deposit/i);
    expect(cash.terms.join(" ")).toMatch(/cash/i);
  });

  it("handles an unconfirmed fee gracefully", () => {
    const a = buildAgreement({ artistName: "A", venueName: "V", date: null, gigFee: null, settleMethod: "cash" });
    expect(a.summary).toContain("TBD");
    expect(a.terms.length).toBeGreaterThan(0);
  });
});
