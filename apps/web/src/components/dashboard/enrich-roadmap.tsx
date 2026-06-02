"use client";

import { Check, Loader2, Circle } from "lucide-react";

type Phase = "prune" | "repair" | "enrich" | "mine_reviews" | "score" | "done";

type Props = {
  currentPhase: Phase | null;
  status: "running" | "completed" | "cancelled" | "error" | null;
  // Per-phase counts
  pruned?: number;
  repaired?: number;
  enriched?: number;
  reviewsMined?: number;
  // Enrich-specific
  showsDone?: number;
  totalShows?: number;
  currentShow?: string | null;
};

type PhaseDef = {
  id: Phase;
  label: string;
  shortLabel: string;
};

const PHASES: PhaseDef[] = [
  { id: "prune",        label: "Prune",        shortLabel: "Prune" },
  { id: "repair",       label: "Repair",       shortLabel: "Repair" },
  { id: "enrich",       label: "Enrich",       shortLabel: "Enrich" },
  { id: "mine_reviews", label: "Mine reviews", shortLabel: "Reviews" },
  { id: "score",        label: "Score",        shortLabel: "Score" },
];

const PHASE_ORDER: Record<Phase, number> = {
  prune: 0, repair: 1, enrich: 2, mine_reviews: 3, score: 4, done: 5,
};

export function EnrichRoadmap({ currentPhase, status, pruned, repaired, enriched, reviewsMined, showsDone, totalShows, currentShow }: Props) {
  if (!currentPhase && !status) return null;

  const currentIdx = currentPhase ? PHASE_ORDER[currentPhase] : -1;
  const isDone = currentPhase === "done" || status === "completed";
  const isError = status === "error";
  const isCancelled = status === "cancelled";

  function getPhaseState(phase: PhaseDef): "done" | "active" | "pending" | "error" {
    const idx = PHASE_ORDER[phase.id];
    if (isError && idx === currentIdx) return "error";
    if (isDone || idx < currentIdx) return "done";
    if (idx === currentIdx) return "active";
    return "pending";
  }

  function getPhaseDetail(phase: PhaseDef): string | null {
    const state = getPhaseState(phase);
    if (state === "pending") return null;
    switch (phase.id) {
      case "prune":        return pruned !== undefined ? `${pruned} removed` : null;
      case "repair":       return repaired !== undefined ? `${repaired} fixed` : null;
      case "enrich":       return state === "active" && currentShow
        ? `${showsDone ?? 0}/${totalShows ?? 0} shows · ${currentShow}`
        : enriched !== undefined ? `${enriched} emails found` : null;
      case "mine_reviews": return reviewsMined !== undefined ? `${reviewsMined} signals` : null;
      case "score":        return state === "done" ? "tiers assigned" : null;
      default:             return null;
    }
  }

  return (
    <div className="mt-3 px-0">
      <div className="flex items-start gap-0">
        {PHASES.map((phase, i) => {
          const state = getPhaseState(phase);
          const detail = getPhaseDetail(phase);
          const isLast = i === PHASES.length - 1;

          return (
            <div key={phase.id} className="flex items-start flex-1 min-w-0">
              <div className="flex flex-col items-center flex-1 min-w-0">
                {/* Node + connector */}
                <div className="flex items-center w-full">
                  {/* Node */}
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                    state === "done" ? "bg-success-green" :
                    state === "active" ? "bg-accent-blue" :
                    state === "error" ? "bg-amber" :
                    "bg-surface border border-border-medium"
                  }`}>
                    {state === "done" && <Check size={10} className="text-white" />}
                    {state === "active" && <Loader2 size={10} className="text-white animate-spin" />}
                    {state === "error" && <span className="text-white text-[8px] font-bold">!</span>}
                    {state === "pending" && <Circle size={8} className="text-border-medium" />}
                  </div>
                  {/* Connector line */}
                  {!isLast && (
                    <div className={`h-0.5 flex-1 mx-0.5 transition-colors ${
                      state === "done" ? "bg-success-green" : "bg-border"
                    }`} />
                  )}
                </div>
                {/* Label */}
                <div className="w-full mt-1 pr-1 min-w-0">
                  <p className={`text-[10px] font-medium truncate ${
                    state === "done" ? "text-success-green" :
                    state === "active" ? "text-accent-blue" :
                    state === "error" ? "text-amber" :
                    "text-text-light"
                  }`}>
                    {phase.shortLabel}
                  </p>
                  {detail && (
                    <p className="text-[9px] text-text-light truncate leading-tight mt-0.5">
                      {detail}
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {isDone && (
        <p className="text-[10px] text-success-green mt-2 flex items-center gap-1">
          <Check size={10} />
          Pipeline complete — {enriched ?? 0} emails found, venues scored A–D
        </p>
      )}
      {isCancelled && (
        <p className="text-[10px] text-text-light mt-2">Stopped · partial results saved</p>
      )}
      {isError && (
        <p className="text-[10px] text-amber mt-2">Error in {currentPhase} phase</p>
      )}
    </div>
  );
}
