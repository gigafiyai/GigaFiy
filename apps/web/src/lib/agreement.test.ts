import { describe, it, expect } from "vitest";
import { buildAgreement, gigifyFee, depositAmount } from "./agreement";

describe("gigifyFee", () => {
  it("is free by default — artists keep 100%, venues pay nothing", () => {
    expect(gigifyFee(1000)).toBe(0);
    expect(gigifyFee(100)).toBe(0);
    expect(gigifyFee(null)).toBe(0);
  });
  it("supports a future percentage fee with a floor", () => {
    expect(gigifyFee(1000, 5, 10)).toBe(50); // 5% of 1000
    expect(gigifyFee(100, 5, 10)).toBe(10); // 5% = 5, floored to min
    expect(gigifyFee(null, 5, 10)).toBe(10);
  });
});

describe("depositAmount", () => {
  it("is 50% of the gig fee", () => {
    expect(depositAmount(400)).toBe(200);
    expect(depositAmount(null)).toBe(0);
  });
});

describe("buildAgreement", () => {
  it("includes parties, engagement, cancellation, and a no-fee clause", () => {
    const a = buildAgreement({
      artistName: "Elijah Stone", venueName: "The Sinclair", venueCity: "Cambridge, MA",
      date: "2026-08-14", startTime: "8:00 PM", gigFee: 400, settleMethod: "deposit",
    });
    expect(a.terms.some((t) => t.includes("Elijah Stone") && t.includes("The Sinclair"))).toBe(true);
    expect(a.terms.some((t) => t.toLowerCase().includes("cancel"))).toBe(true);
    expect(a.terms.some((t) => t.toLowerCase().includes("no booking fees"))).toBe(true);
    expect(a.terms.some((t) => t.includes("is due at confirmation"))).toBe(false);
    expect(a.depositAmount).toBe(200);
    expect(a.gigifyFee).toBe(0);
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
