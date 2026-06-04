// Cold-email send throttling.
//
// Blasting hundreds of cold emails in one day from a single sender torches
// domain reputation and lands everything in spam. We pace sends with a daily
// cap that scales by plan. The free tier deliberately keeps volume tiny so a
// new sender warms up safely; paid tiers unlock more once the artist is
// committed (and, ideally, sending from an authenticated subdomain).
//
// Caps are per-artist, per-calendar-day (server time), counted from the
// Outreach table (channel EMAIL, actually sent).

import { prisma } from "@gigify/db";

export type Plan = "free" | "pro" | "premium";

// Daily cold-email send cap by plan. Conservative on purpose — cold-outreach
// deliverability depends far more on consistency + low volume than on blasting.
export const PLAN_DAILY_CAP: Record<Plan, number> = {
  free: 10,
  pro: 25,
  premium: 50,
};

export function normalizePlan(plan: string | null | undefined): Plan {
  if (plan === "pro" || plan === "premium") return plan;
  return "free";
}

export function dailyCapForPlan(plan: string | null | undefined): number {
  return PLAN_DAILY_CAP[normalizePlan(plan)];
}

// Start of the current day in server local time.
function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

// How many emails this artist has actually sent today.
export async function sentToday(artistId: string): Promise<number> {
  return prisma.outreach.count({
    where: {
      artistId,
      channel: "EMAIL",
      status: "SENT",
      sentAt: { gte: startOfToday() },
    },
  });
}

export type SendBudget = {
  plan: Plan;
  cap: number;
  sentToday: number;
  remaining: number;
};

// The send budget left for an artist today. `remaining` is what a bulk send
// is allowed to push out right now.
export async function getSendBudget(
  artistId: string,
  plan: string | null | undefined
): Promise<SendBudget> {
  const normalized = normalizePlan(plan);
  const cap = PLAN_DAILY_CAP[normalized];
  const used = await sentToday(artistId);
  return {
    plan: normalized,
    cap,
    sentToday: used,
    remaining: Math.max(0, cap - used),
  };
}
