export type SurveyType = "POST_BOOKING" | "DAY_AFTER";

export type SurveyQuestion =
  | { id: "q1" | "q2" | "q3"; kind: "single"; prompt: string; options: string[] }
  | { id: "q2"; kind: "multi"; prompt: string; options: string[] }
  | { id: "q4" | "q5"; kind: "emoji"; prompt: string }
  | { id: "q4"; kind: "text"; prompt: string };

export type SurveyDefinition = {
  type: SurveyType;
  title: string;
  subtitle: string;
  questions: SurveyQuestion[];
};

// Survey 1 — fires in-app on Stripe deposit confirmation, BEFORE the confirmation email.
export const SURVEY_1: SurveyDefinition = {
  type: "POST_BOOKING",
  title: "Quick win — 4 questions",
  subtitle: "Helps us book more shows like yours.",
  questions: [
    {
      id: "q1",
      kind: "single",
      prompt: "What was the main reason you said yes?",
      options: [
        "The reel / video clips",
        "The email felt personal and relevant",
        "The 24-hour cancellation — zero risk",
        "The phone call from Nova",
        "He was already touring near me",
        "Pricing and terms worked",
      ],
    },
    {
      id: "q2",
      kind: "single",
      prompt: "What almost stopped you?",
      options: [
        "Wasn't sure about draw / crowd size",
        "Budget concern",
        "Didn't know the artist yet",
        "Timing uncertainty",
        "Nothing — easy yes",
      ],
    },
    {
      id: "q3",
      kind: "single",
      prompt: "How did you first hear about this?",
      options: [
        "Email from Gigify",
        "Phone call from Nova",
        "Word of mouth / referral",
        "Saw the artist perform nearby",
      ],
    },
    {
      id: "q4",
      kind: "emoji",
      prompt: "How smooth was the booking process?",
    },
  ],
};

// Survey 2 — T+24h via SendGrid.
export const SURVEY_2: SurveyDefinition = {
  type: "DAY_AFTER",
  title: "One day in — quick reflection",
  subtitle: "5 questions, ~60 seconds.",
  questions: [
    {
      id: "q1",
      kind: "single",
      prompt: "What part of the offer stood out most?",
      options: [
        "The 24-hour cancellation — genuinely no risk",
        "The email felt targeted, not generic",
        "The artist was already active in my area",
        "The whole process was fast and easy",
      ],
    },
    {
      id: "q2",
      kind: "multi",
      prompt: "What would make you book through Gigify again?",
      options: [
        "More artist options in my genre",
        "Artist draw data and past performance stats",
        "A portal to post my open dates",
        "Contract and payment fully integrated",
        "Already planning to — this was great",
      ],
    },
    {
      id: "q3",
      kind: "single",
      prompt: "How likely are you to refer another venue?",
      options: [
        "Very likely — already have someone in mind",
        "Likely — if the show goes well",
        "Maybe — check back after the show",
        "Not sure yet",
      ],
    },
    { id: "q4", kind: "text", prompt: "What made you open the first email?" },
    { id: "q5", kind: "emoji", prompt: "Overall rating of the Gigify experience" },
  ],
};

export function getSurvey(type: SurveyType): SurveyDefinition {
  return type === "POST_BOOKING" ? SURVEY_1 : SURVEY_2;
}
