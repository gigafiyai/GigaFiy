// Call basis — how defensible it is to call a given venue.
//   consent — explicit permission captured (strongest)
//   warm    — they've replied or are engaged in the pipeline (good basis)
//   cold    — no prior interaction (riskiest; allowed only with attestation)
// The UI defaults the call pool to consent + warm.

export type CallBasis = "consent" | "warm" | "cold";

const WARM_STAGES = new Set(["CALLED", "INTERESTED", "DEPOSIT", "BOOKED"]);

export function callBasis(s: {
  callConsent: boolean;
  replied: boolean;
  pipelineStage: string | null;
}): CallBasis {
  if (s.callConsent) return "consent";
  if (s.replied || (s.pipelineStage != null && WARM_STAGES.has(s.pipelineStage))) return "warm";
  return "cold";
}

export const isWarmOrBetter = (b: CallBasis) => b === "consent" || b === "warm";

export const BASIS_LABEL: Record<CallBasis, string> = {
  consent: "consented",
  warm: "warm",
  cold: "cold",
};
