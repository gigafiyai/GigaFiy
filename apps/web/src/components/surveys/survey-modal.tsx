"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { getSurvey, type SurveyType } from "@/lib/survey-questions";
import { X, Check, Loader2 } from "lucide-react";

type Props = {
  surveyId: string;
  surveyType: SurveyType;
  venueName: string;
  onClose: () => void;
  onSubmitted: () => void;
};

const EMOJI_SCALE = [
  { value: "1", label: "😞" },
  { value: "2", label: "😕" },
  { value: "3", label: "😐" },
  { value: "4", label: "🙂" },
  { value: "5", label: "🤩" },
];

export function SurveyModal({ surveyId, surveyType, venueName, onClose, onSubmitted }: Props) {
  const survey = getSurvey(surveyType);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allAnswered = survey.questions.every((q) => answers[q.id] !== undefined && answers[q.id] !== "");

  function setSingle(qid: string, value: string) {
    setAnswers((a) => ({ ...a, [qid]: value }));
  }

  function toggleMulti(qid: string, option: string) {
    setAnswers((a) => {
      const current = a[qid] ? a[qid].split("||") : [];
      const next = current.includes(option)
        ? current.filter((c) => c !== option)
        : [...current, option];
      return { ...a, [qid]: next.join("||") };
    });
  }

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/surveys/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ surveyId, answers }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      onSubmitted();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Submit failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4">
      <div className="bg-background rounded-lg shadow-xl max-w-xl w-full max-h-[90vh] flex flex-col">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-text">{survey.title}</h2>
            <p className="text-xs text-text-light mt-0.5">
              {survey.subtitle} · {venueName}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-text-light hover:text-text"
          >
            <X size={16} />
          </button>
        </div>
        <div className="px-5 py-4 space-y-6 overflow-y-auto">
          {survey.questions.map((q) => (
            <div key={q.id}>
              <p className="text-sm font-medium text-text mb-2">{q.prompt}</p>
              {q.kind === "single" && (
                <div className="space-y-1.5">
                  {q.options.map((opt) => (
                    <label
                      key={opt}
                      className={`flex items-center gap-2.5 px-3 py-2 rounded border cursor-pointer transition-colors ${
                        answers[q.id] === opt
                          ? "bg-accent-blue-bg border-accent-blue"
                          : "border-border hover:bg-surface"
                      }`}
                    >
                      <input
                        type="radio"
                        name={q.id}
                        checked={answers[q.id] === opt}
                        onChange={() => setSingle(q.id, opt)}
                        className="accent-accent-blue"
                      />
                      <span className="text-sm text-text">{opt}</span>
                    </label>
                  ))}
                </div>
              )}
              {q.kind === "multi" && (
                <div className="space-y-1.5">
                  {q.options.map((opt) => {
                    const selected = (answers[q.id] ?? "").split("||").includes(opt);
                    return (
                      <label
                        key={opt}
                        className={`flex items-center gap-2.5 px-3 py-2 rounded border cursor-pointer transition-colors ${
                          selected
                            ? "bg-accent-blue-bg border-accent-blue"
                            : "border-border hover:bg-surface"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => toggleMulti(q.id, opt)}
                          className="accent-accent-blue"
                        />
                        <span className="text-sm text-text">{opt}</span>
                      </label>
                    );
                  })}
                </div>
              )}
              {q.kind === "emoji" && (
                <div className="flex gap-2">
                  {EMOJI_SCALE.map(({ value, label }) => (
                    <button
                      type="button"
                      key={value}
                      onClick={() => setSingle(q.id, value)}
                      className={`flex-1 py-3 rounded border text-2xl transition-colors ${
                        answers[q.id] === value
                          ? "bg-accent-blue-bg border-accent-blue"
                          : "border-border hover:bg-surface"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
              {q.kind === "text" && (
                <textarea
                  value={answers[q.id] ?? ""}
                  onChange={(e) => setSingle(q.id, e.target.value)}
                  rows={3}
                  placeholder="Optional"
                  className="w-full px-3 py-2 text-sm bg-white border border-border rounded-md text-text focus:outline-none focus:border-accent-blue resize-y"
                />
              )}
            </div>
          ))}
        </div>
        <div className="px-5 py-4 border-t border-border flex items-center justify-between bg-surface">
          {error ? (
            <span className="text-xs text-amber">{error}</span>
          ) : (
            <span className="text-xs text-text-light">
              {Object.keys(answers).filter((k) => answers[k]).length} / {survey.questions.length}
            </span>
          )}
          <Button variant="primary" size="sm" onClick={submit} disabled={!allAnswered || submitting}>
            {submitting ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
            {submitting ? "Submitting…" : "Submit"}
          </Button>
        </div>
      </div>
    </div>
  );
}
