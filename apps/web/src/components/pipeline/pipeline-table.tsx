"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Phone } from "lucide-react";
import { cn, formatDate, formatMiles } from "@/lib/utils";
import { StageBadge } from "./stage-badge";
import { EmailStatus } from "./email-status";
import { RowDetail } from "./row-detail";
import type { PipelineRow, PipelineStage, CallStatus } from "@/lib/types";

interface PipelineTableProps {
  rows: PipelineRow[];
  onChange?: () => void;
  selectedIds: Set<string>;
  onSelectionChange: (next: Set<string>) => void;
}

function CallStatusDot({ status }: { status: CallStatus | null }) {
  if (!status) return <span className="text-text-light text-xs">—</span>;

  const config: Record<CallStatus, { label: string; color: string }> = {
    QUEUED: { label: "Queued", color: "text-text-light" },
    INITIATED: { label: "Calling", color: "text-accent-blue" },
    ANSWERED: { label: "Answered", color: "text-success-green" },
    VOICEMAIL: { label: "Voicemail", color: "text-amber" },
    NO_ANSWER: { label: "No answer", color: "text-text-light" },
    FAILED: { label: "Failed", color: "text-red-400" },
  };

  const c = config[status];
  return (
    <span className={cn("text-xs flex items-center gap-1", c.color)}>
      <Phone size={11} />
      {c.label}
    </span>
  );
}

export function PipelineTable({
  rows,
  onChange,
  selectedIds,
  onSelectionChange,
}: PipelineTableProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  function toggleExpand(id: string) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  function toggleSelect(id: string) {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onSelectionChange(next);
  }

  function toggleAll() {
    if (selectedIds.size === rows.length) {
      onSelectionChange(new Set());
    } else {
      onSelectionChange(new Set(rows.map((r) => r.id)));
    }
  }

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-text-medium text-sm">No venues in this stage</p>
        <p className="text-text-light text-xs mt-1">
          Run the discovery engine to find venues near upcoming shows
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse min-w-[900px]">
        <thead>
          <tr className="border-b border-border bg-surface">
            <th className="w-8 px-3 py-2.5">
              <input
                type="checkbox"
                checked={selectedIds.size === rows.length && rows.length > 0}
                onChange={toggleAll}
                className="w-3.5 h-3.5 rounded border-border-medium accent-accent-blue cursor-pointer"
              />
            </th>
            <th className="w-6" />
            <th className="text-left px-3 py-2.5 text-xs font-medium text-text-light">
              Venue
            </th>
            <th className="text-left px-3 py-2.5 text-xs font-medium text-text-light">
              Type / Buyer
            </th>
            <th className="text-left px-3 py-2.5 text-xs font-medium text-text-light">
              Nearest Show
            </th>
            <th className="text-left px-3 py-2.5 text-xs font-medium text-text-light">
              Email
            </th>
            <th className="text-left px-3 py-2.5 text-xs font-medium text-text-light">
              Call
            </th>
            <th className="text-left px-3 py-2.5 text-xs font-medium text-text-light">
              Stage
            </th>
            <th className="text-left px-3 py-2.5 text-xs font-medium text-text-light">
              Deposit
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((row) => {
            const isExpanded = expandedId === row.id;
            const isSelected = selectedIds.has(row.id);

            return (
              <>
                <tr
                  key={row.id}
                  className={cn(
                    "group transition-colors duration-75",
                    isExpanded ? "bg-surface" : "hover:bg-surface",
                    isSelected && "bg-accent-blue-bg"
                  )}
                >
                  <td className="px-3 py-2.5">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelect(row.id)}
                      className="w-3.5 h-3.5 rounded border-border-medium accent-accent-blue cursor-pointer"
                    />
                  </td>
                  <td className="pr-1 py-2.5">
                    <button
                      onClick={() => toggleExpand(row.id)}
                      className="text-text-light hover:text-text-medium transition-colors cursor-pointer"
                    >
                      {isExpanded ? (
                        <ChevronDown size={14} />
                      ) : (
                        <ChevronRight size={14} />
                      )}
                    </button>
                  </td>
                  <td
                    className="px-3 py-2.5 cursor-pointer"
                    onClick={() => toggleExpand(row.id)}
                  >
                    <p className="text-sm font-medium text-text">{row.venueName}</p>
                    <p className="text-xs text-text-light">
                      {row.city}, {row.state}
                    </p>
                  </td>
                  <td className="px-3 py-2.5">
                    <p className="text-xs text-text-medium capitalize">
                      {row.venueType.replace(/_/g, " ").toLowerCase()}
                    </p>
                    {row.decisionMakerRole && (
                      <p className="text-xs text-text-light">{row.decisionMakerRole}</p>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    {row.nearestShowDate && row.distanceMiles != null ? (
                      <div>
                        <p className="text-xs text-text-medium">
                          {formatDate(row.nearestShowDate)}
                        </p>
                        <p className="text-xs text-text-light">
                          {formatMiles(row.distanceMiles)} away
                        </p>
                      </div>
                    ) : (
                      <span className="text-text-light text-xs">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    <EmailStatus status={row.emailStatus} openedAt={row.emailOpenedAt} />
                  </td>
                  <td className="px-3 py-2.5">
                    <CallStatusDot status={row.callStatus} />
                  </td>
                  <td className="px-3 py-2.5">
                    <StageBadge stage={row.stage} />
                  </td>
                  <td className="px-3 py-2.5">
                    {row.depositPaidAt ? (
                      <span className="text-xs text-success-green font-medium">
                        Paid
                      </span>
                    ) : (
                      <span className="text-xs text-text-light">—</span>
                    )}
                  </td>
                </tr>
                {isExpanded && (
                  <tr key={`${row.id}-detail`}>
                    <td colSpan={9} className="p-0">
                      <RowDetail row={row} onChange={onChange} />
                    </td>
                  </tr>
                )}
              </>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
