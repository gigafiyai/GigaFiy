import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the DB so the throttle module can be imported without a real Prisma client.
vi.mock("@gigify/db", () => ({
  prisma: { outreach: { count: vi.fn() } },
}));

import { prisma } from "@gigify/db";
import { normalizePlan, dailyCapForPlan, PLAN_DAILY_CAP, getSendBudget } from "./send-throttle";

const countMock = prisma.outreach.count as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  countMock.mockReset();
});

describe("normalizePlan", () => {
  it("passes through known paid plans", () => {
    expect(normalizePlan("pro")).toBe("pro");
    expect(normalizePlan("premium")).toBe("premium");
  });
  it("defaults unknown/empty plans to free", () => {
    expect(normalizePlan("garbage")).toBe("free");
    expect(normalizePlan(null)).toBe("free");
    expect(normalizePlan(undefined)).toBe("free");
  });
});

describe("dailyCapForPlan", () => {
  it("maps each plan to its cap", () => {
    expect(dailyCapForPlan("free")).toBe(10);
    expect(dailyCapForPlan("pro")).toBe(25);
    expect(dailyCapForPlan("premium")).toBe(50);
    expect(dailyCapForPlan(undefined)).toBe(PLAN_DAILY_CAP.free);
  });
});

describe("getSendBudget", () => {
  it("computes remaining from today's sent count", async () => {
    countMock.mockResolvedValue(3);
    const b = await getSendBudget("artist1", "free");
    expect(b).toEqual({ plan: "free", cap: 10, sentToday: 3, remaining: 7 });
  });

  it("never returns negative remaining when over the cap", async () => {
    countMock.mockResolvedValue(15);
    const b = await getSendBudget("artist1", "free");
    expect(b.remaining).toBe(0);
  });

  it("uses the higher cap for paid plans", async () => {
    countMock.mockResolvedValue(10);
    const b = await getSendBudget("artist1", "pro");
    expect(b.cap).toBe(25);
    expect(b.remaining).toBe(15);
  });
});
