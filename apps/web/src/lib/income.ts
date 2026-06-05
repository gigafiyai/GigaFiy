// Income & forecasting — the ServiceTitan "becomes their business" transplant.
// Turns the pipeline into a money picture: what's earned, what's contractually
// booked, and a probability-weighted forecast of what's still in play
// (Salesforce-style opportunity weighting).

// Likelihood a lead at each pipeline stage ultimately books. Used to weight the
// pipeline into an expected-value forecast.
export const STAGE_WIN_PROBABILITY: Record<string, number> = {
  QUEUED: 0.02,
  EMAILED: 0.05,
  CALLED: 0.10,
  INTERESTED: 0.35,
  DEPOSIT: 0.90, // deposit paid — very likely to play
  BOOKED: 1.0,
  DECLINED: 0,
  CANCELLED: 0,
  OPTED_OUT: 0,
};

export function stageProbability(stage: string | null | undefined): number {
  return STAGE_WIN_PROBABILITY[stage ?? ""] ?? 0;
}

// Probability-weighted expected value of a set of pipeline leads.
export function weightedPipelineValue(
  leads: { stage: string | null }[],
  expectedFee: number
): number {
  return Math.round(leads.reduce((sum, l) => sum + stageProbability(l.stage) * expectedFee, 0));
}

export type IncomeSummary = {
  earnedToDate: number;    // revenue from completed shows
  bookedUpcoming: number;  // contracted fees for upcoming confirmed shows
  depositsCollected: number;
  pipelineValue: number;   // probability-weighted expected value of open leads
  projectedTotal: number;  // bookedUpcoming + pipelineValue
  avgFee: number;
  upcomingCount: number;
};

export function summarizeIncome(input: {
  completedRevenue: number;
  confirmedUpcomingFees: number;
  upcomingCount: number;
  depositsCollected: number;
  pipelineLeads: { stage: string | null }[];
  avgFee: number;
}): IncomeSummary {
  const pipelineValue = weightedPipelineValue(input.pipelineLeads, input.avgFee);
  const bookedUpcoming = Math.round(input.confirmedUpcomingFees);
  return {
    earnedToDate: Math.round(input.completedRevenue),
    bookedUpcoming,
    depositsCollected: Math.round(input.depositsCollected),
    pipelineValue,
    projectedTotal: bookedUpcoming + pipelineValue,
    avgFee: Math.round(input.avgFee),
    upcomingCount: input.upcomingCount,
  };
}
