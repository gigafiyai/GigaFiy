"use client";

import { useEffect, useState } from "react";
import { SurveyModal } from "@/components/surveys/survey-modal";
import { Check, Loader2, ShieldCheck, Clock } from "lucide-react";

type Props = {
  pipelineId: string;
  stage: string;
  artistName: string;
  venueName: string;
  survey: { id: string; completed: boolean } | null;
  cancellationDeadline: string | null;
};

export function SuccessFlow(props: Props) {
  const [showSurvey, setShowSurvey] = useState(
    !!props.survey && !props.survey.completed
  );
  const [polling, setPolling] = useState(props.stage !== "DEPOSIT" && props.stage !== "BOOKED");
  const [surveyId, setSurveyId] = useState(props.survey?.id ?? null);

  // Webhook might not have arrived yet — poll for up to 30s if payment hasn't
  // landed in our DB. Stripe usually webhooks within seconds.
  useEffect(() => {
    if (!polling) return;
    const startedAt = Date.now();
    const interval = setInterval(async () => {
      if (Date.now() - startedAt > 30000) {
        clearInterval(interval);
        setPolling(false);
        return;
      }
      const res = await fetch(`/api/checkout/status?pipelineId=${props.pipelineId}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.stage === "DEPOSIT" || data.stage === "BOOKED") {
        clearInterval(interval);
        setPolling(false);
        if (data.surveyId && !data.surveyCompleted) {
          setSurveyId(data.surveyId);
          setShowSurvey(true);
        }
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [polling, props.pipelineId]);

  const deadline = props.cancellationDeadline
    ? new Date(props.cancellationDeadline).toLocaleString()
    : null;

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center px-5 py-10">
      <div className="max-w-md w-full bg-background border border-border rounded-lg p-6 space-y-4">
        {polling ? (
          <>
            <div className="flex items-center gap-2 text-text">
              <Loader2 size={16} className="animate-spin" />
              <p className="text-base font-medium">Confirming payment…</p>
            </div>
            <p className="text-sm text-text-medium">
              Stripe is finalizing your charge. This usually takes 2-3 seconds.
            </p>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2 text-success-green">
              <Check size={18} />
              <p className="text-base font-semibold text-text">
                You're booked — deposit received.
              </p>
            </div>
            <p className="text-sm text-text-medium">
              {props.artistName} is locked in for {props.venueName}. We'll email the
              contract and calendar invite shortly.
            </p>
            <div className="border border-success-green/20 bg-success-green-bg rounded p-3 flex items-start gap-2">
              <ShieldCheck size={14} className="text-success-green shrink-0 mt-0.5" />
              <div className="text-xs text-text-medium">
                <p>
                  <span className="font-medium text-success-green">
                    24-hour free cancellation
                  </span>{" "}
                  is active.
                </p>
                {deadline && (
                  <p className="mt-1 flex items-center gap-1">
                    <Clock size={11} />
                    Closes at {deadline}
                  </p>
                )}
              </div>
            </div>
            {surveyId && !showSurvey && (
              <button
                type="button"
                onClick={() => setShowSurvey(true)}
                className="text-sm text-accent-blue hover:underline"
              >
                4-question quick survey →
              </button>
            )}
            {!surveyId && (
              <p className="text-xs text-text-light">
                Confirmation email + Survey 2 (day-after) are queued.
              </p>
            )}
          </>
        )}
      </div>

      {showSurvey && surveyId && (
        <SurveyModal
          surveyId={surveyId}
          surveyType="POST_BOOKING"
          venueName={props.venueName}
          onClose={() => setShowSurvey(false)}
          onSubmitted={() => setShowSurvey(false)}
        />
      )}
    </div>
  );
}
