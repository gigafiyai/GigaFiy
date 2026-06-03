export type PipelineStage =
  | "QUEUED"
  | "EMAILED"
  | "CALLED"
  | "INTERESTED"
  | "DEPOSIT"
  | "BOOKED"
  | "CANCELLED"
  | "DECLINED";

export type VenueType =
  | "BAR"
  | "RESTAURANT"
  | "MUSIC_CLUB"
  | "ARTS_CENTER"
  | "FARMERS_MARKET"
  | "FESTIVAL"
  | "OTHER";

export type OutreachStatus =
  | "QUEUED"
  | "SENT"
  | "OPENED"
  | "CLICKED"
  | "REPLIED"
  | "OPTED_OUT";

export type CallStatus =
  | "QUEUED"
  | "INITIATED"
  | "ANSWERED"
  | "VOICEMAIL"
  | "NO_ANSWER"
  | "FAILED";

export interface PipelineRow {
  id: string;
  venueId: string;
  venueName: string;
  venueType: VenueType;
  city: string;
  state: string;
  decisionMakerName: string | null;
  decisionMakerRole: string | null;
  decisionMakerEmail: string | null;
  decisionMakerPhone: string | null;
  venuePhone: string | null;
  venueEmail: string | null;
  nearestShowDate: string | null;
  nearestShowName: string | null;
  nearestShowCity: string | null;
  distanceMiles: number | null;
  emailStatus: OutreachStatus | null;
  emailOpenedAt: string | null;
  callStatus: CallStatus | null;
  stage: PipelineStage;
  depositAmount: number | null;
  depositPaidAt: string | null;
  cancellationDeadline: string | null;
  bookedShowDate: string | null;
  bookedShowFee: number | null;
  notes: string | null;
  hostsLiveMusic: boolean | null;
  narrative: string | null;
  instagramHandle: string | null;
  vibe: string[];
  genresHosted: string[];
  suggestedFeeLow: number;
  suggestedFeeHigh: number;
  suggestedFee: number;
  suggestedDeposit: number;
  priceConfidence: "high" | "medium" | "low";
  priceReasoning: string[];
}
