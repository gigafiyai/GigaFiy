"use client";

import { useEffect, useState } from "react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { SurveyModal } from "@/components/surveys/survey-modal";
import { ClipboardList, Check, Play } from "lucide-react";

type SurveyType = "POST_BOOKING" | "DAY_AFTER";

type SurveyRow = {
  id: string;
  pipelineId: string;
  venueId: string;
  venueName: string;
  city: string;
  state: string;
  surveyType: SurveyType;
  completed: boolean;
  completedAt: string | null;
  createdAt: string;
  answers: {
    q1: string | null;
    q2: string | null;
    q3: string | null;
    q4: string | null;
    q5: string | null;
  };
};

const TYPE_LABELS: Record<SurveyType, string> = {
  POST_BOOKING: "Survey 1 — Post-Booking",
  DAY_AFTER: "Survey 2 — Day-After",
};

export default function SurveysPage() {
  const [surveys, setSurveys] = useState<SurveyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSurvey, setActiveSurvey] = useState<SurveyRow | null>(null);

  async function refresh() {
    const data: SurveyRow[] = await fetch("/api/surveys").then((r) => r.json());
    setSurveys(data);
    setLoading(false);
  }

  useEffect(() => {
    refresh();
  }, []);

  const pending = surveys.filter((s) => !s.completed);
  const completed = surveys.filter((s) => s.completed);

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Surveys"
        description="Survey 1 fires in-app on deposit, before confirmation email"
      />

      <div className="p-6 space-y-6 overflow-y-auto">
        <div className="grid grid-cols-2 gap-4">
          <div className="border border-border rounded-lg p-4 bg-background">
            <div className="flex items-center gap-2 mb-2">
              <ClipboardList size={14} className="text-accent-blue" />
              <p className="text-xs uppercase tracking-wide text-text-light">Survey 1</p>
            </div>
            <p className="text-sm text-text">Post-booking — in-app modal</p>
            <p className="text-xs text-text-light mt-1">
              Fires the instant the Stripe deposit confirms. Blocks the confirmation email
              until completed. 4 questions, target 90%+ completion.
            </p>
          </div>
          <div className="border border-border rounded-lg p-4 bg-background">
            <div className="flex items-center gap-2 mb-2">
              <ClipboardList size={14} className="text-purple" />
              <p className="text-xs uppercase tracking-wide text-text-light">Survey 2</p>
            </div>
            <p className="text-sm text-text">Day-after — SendGrid email</p>
            <p className="text-xs text-text-light mt-1">
              Sent 24h after booking confirmation. 5 questions including one open text.
              Target 60%+ completion.
            </p>
          </div>
        </div>

        <section className="border border-border rounded-lg bg-background overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <h3 className="text-sm font-medium text-text">
              Pending ({pending.length})
            </h3>
          </div>
          {loading ? (
            <div className="px-4 py-8 text-sm text-text-light">Loading…</div>
          ) : pending.length === 0 ? (
            <div className="px-4 py-8 text-sm text-text-light">
              No pending surveys. They appear here once deposits start landing.
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {pending.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center justify-between px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-medium text-text">{s.venueName}</p>
                    <p className="text-xs text-text-light">
                      {s.city}, {s.state} · {TYPE_LABELS[s.surveyType]}
                    </p>
                  </div>
                  <Button variant="primary" size="sm" onClick={() => setActiveSurvey(s)}>
                    <Play size={13} />
                    Open
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="border border-border rounded-lg bg-background overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <h3 className="text-sm font-medium text-text">
              Completed ({completed.length})
            </h3>
          </div>
          {completed.length === 0 ? (
            <div className="px-4 py-8 text-sm text-text-light">
              Responses will land here.
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {completed.map((s) => (
                <li key={s.id} className="px-4 py-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-text flex items-center gap-2">
                        {s.venueName}
                        <Check size={13} className="text-success-green" />
                      </p>
                      <p className="text-xs text-text-light">
                        {s.city}, {s.state} · {TYPE_LABELS[s.surveyType]}
                      </p>
                    </div>
                    {s.completedAt && (
                      <p className="text-xs text-text-light">
                        {new Date(s.completedAt).toLocaleString()}
                      </p>
                    )}
                  </div>
                  <div className="mt-2 grid grid-cols-1 gap-1 text-xs text-text-medium pl-1">
                    {(["q1", "q2", "q3", "q4", "q5"] as const).map((k) =>
                      s.answers[k] ? (
                        <div key={k}>
                          <span className="text-text-light">{k.toUpperCase()}:</span>{" "}
                          {s.answers[k]?.replace(/\|\|/g, ", ")}
                        </div>
                      ) : null
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {activeSurvey && (
        <SurveyModal
          surveyId={activeSurvey.id}
          surveyType={activeSurvey.surveyType}
          venueName={activeSurvey.venueName}
          onClose={() => setActiveSurvey(null)}
          onSubmitted={refresh}
        />
      )}
    </div>
  );
}
