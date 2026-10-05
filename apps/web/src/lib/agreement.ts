// Performance-agreement generation.
//
// Every booking produces a plain-English agreement the venue accepts by
// confirming (clickwrap — a legally recognized form of assent, no e-sign
// dependency). The gig fee can settle however the venue likes (deposit online
// or cash on the night).
//
// Booking is FREE: the artist keeps 100% of the fee and the venue pays nothing
// to Gigify. Artists are how venues discover Gigify, so nothing in this flow
// should give either side a reason to book off-platform. The fee lever stays
// (env-configurable, default 0) for a future venue-side service fee; while it
// is 0 the agreement carries no fee clause at all.
export const GIGIFY_FEE_PERCENT = Number(process.env.GIGIFY_FEE_PERCENT ?? 0);
export const GIGIFY_FEE_MIN_USD = Number(process.env.GIGIFY_FEE_MIN_USD ?? 0);
export const DEPOSIT_PERCENT = 50;
export const CANCELLATION_WINDOW_HOURS = 24;

export type SettleMethod = "deposit" | "cash";

// The Gigify booking fee for a given gig fee. Pure so the rates are testable;
// defaults come from env (0 = free).
export function gigifyFee(
  gigFee: number | null | undefined,
  percent: number = GIGIFY_FEE_PERCENT,
  minUsd: number = GIGIFY_FEE_MIN_USD
): number {
  const base = gigFee && gigFee > 0 ? Math.round((gigFee * percent) / 100) : 0;
  return Math.max(minUsd, base);
}

export function depositAmount(gigFee: number | null | undefined): number {
  return gigFee && gigFee > 0 ? Math.round((gigFee * DEPOSIT_PERCENT) / 100) : 0;
}

export type AgreementInput = {
  artistName: string;
  venueName: string;
  venueCity?: string | null;
  date: string | null;   // YYYY-MM-DD
  startTime?: string | null;
  gigFee: number | null;
  settleMethod: SettleMethod;
};

export type Agreement = {
  title: string;
  summary: string;
  terms: string[];
  gigFee: number | null;
  gigifyFee: number;
  depositAmount: number;
  settleMethod: SettleMethod;
};

function money(n: number): string {
  return `$${Math.round(n).toLocaleString()}`;
}

function prettyDate(iso: string | null): string {
  if (!iso) return "a date to be confirmed";
  const d = new Date(iso + "T00:00:00");
  return isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
}

export function buildAgreement(input: AgreementInput): Agreement {
  const fee = gigifyFee(input.gigFee);
  const dep = depositAmount(input.gigFee);
  const when = `${prettyDate(input.date)}${input.startTime ? ` at ${input.startTime}` : ""}`;
  const feeClause = input.gigFee ? `a performance fee of ${money(input.gigFee)}` : "a performance fee to be confirmed";

  const settleClause =
    input.settleMethod === "deposit"
      ? `The Venue will pay a ${DEPOSIT_PERCENT}% deposit (${money(dep)}) online to hold the date; the balance is due to the Artist on the performance date.`
      : `The Venue elects to settle the full performance fee in cash to the Artist on the performance date.`;

  const terms = [
    `Parties: ${input.artistName} ("Artist") and ${input.venueName}${input.venueCity ? ` of ${input.venueCity}` : ""} ("Venue").`,
    `Engagement: The Venue books the Artist to perform on ${when}, for ${feeClause}.`,
    settleClause,
    `Cancellation: The Venue may cancel within ${CANCELLATION_WINDOW_HOURS} hours of confirmation for a full refund of any amount paid. After that window, deposits are non-refundable.`,
    fee > 0
      ? `Booking fee: A Gigify booking fee of ${money(fee)} is due at confirmation and is separate from the performance fee.`
      : `No booking fees: Gigify charges no fee to the Venue or the Artist for this booking. The Artist receives the full performance fee.`,
    `Acceptance: By confirming this booking, the Venue agrees to these terms. This electronic acceptance constitutes a binding agreement.`,
  ];

  return {
    title: `Performance Agreement — ${input.artistName} × ${input.venueName}`,
    summary: `${input.artistName} to perform at ${input.venueName} on ${when} for ${input.gigFee ? money(input.gigFee) : "TBD"}.`,
    terms,
    gigFee: input.gigFee ?? null,
    gigifyFee: fee,
    depositAmount: dep,
    settleMethod: input.settleMethod,
  };
}
