import { cn } from "@/lib/utils";
import type { PipelineStage } from "@/lib/types";

const stageConfig: Record<
  PipelineStage,
  { label: string; className: string; dotColor: string }
> = {
  QUEUED: {
    label: "Queued",
    className: "bg-surface text-text-medium border-border",
    dotColor: "bg-text-light",
  },
  EMAILED: {
    label: "Emailed",
    className: "bg-accent-blue-bg text-accent-blue border-accent-blue/20",
    dotColor: "bg-accent-blue",
  },
  CALLED: {
    label: "Called",
    className: "bg-purple-bg text-purple border-purple/20",
    dotColor: "bg-purple",
  },
  INTERESTED: {
    label: "Interested",
    className: "bg-amber-bg text-amber border-amber/20",
    dotColor: "bg-amber",
  },
  DEPOSIT: {
    label: "Deposit",
    className: "bg-success-green-bg text-success-green border-success-green/20",
    dotColor: "bg-success-green",
  },
  BOOKED: {
    label: "Booked",
    className: "bg-success-green-bg text-success-green border-success-green/20",
    dotColor: "bg-success-green",
  },
  CANCELLED: {
    label: "Cancelled",
    className: "bg-red-50 text-red-500 border-red-200",
    dotColor: "bg-red-400",
  },
  DECLINED: {
    label: "Declined",
    className: "bg-surface text-text-light border-border",
    dotColor: "bg-text-light",
  },
};

interface StageBadgeProps {
  stage: PipelineStage;
  className?: string;
}

export function StageBadge({ stage, className }: StageBadgeProps) {
  const config = stageConfig[stage];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium border",
        config.className,
        className
      )}
    >
      <span className={cn("w-1.5 h-1.5 rounded-full", config.dotColor)} />
      {config.label}
    </span>
  );
}

export function StagePill({
  stage,
  active,
  onClick,
}: {
  stage: PipelineStage | "ALL";
  active: boolean;
  onClick: () => void;
}) {
  const label =
    stage === "ALL"
      ? "All"
      : stageConfig[stage as PipelineStage]?.label ?? stage;

  return (
    <button
      onClick={onClick}
      className={cn(
        "px-3 py-1 rounded-full text-xs font-medium border transition-colors duration-100 cursor-pointer",
        active
          ? "bg-text text-background border-text"
          : "bg-background text-text-medium border-border hover:bg-surface-hover"
      )}
    >
      {label}
    </button>
  );
}
