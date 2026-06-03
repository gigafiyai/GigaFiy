"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { SurveyModal } from "@/components/surveys/survey-modal";
import { formatCurrency, formatDate, formatMiles, timeUntilDeadline } from "@/lib/utils";
import type { PipelineRow } from "@/lib/types";
import {
  Mail,
  Phone,
  FileText,
  Link as LinkIcon,
  Check,
  ClipboardList,
  MapPin,
  User,
  Clock,
  DollarSign,
  X,
  Loader2,
  AlertCircle,
  Copy,
  UserSearch,
} from "lucide-react";

interface RowDetailProps {
  row: PipelineRow;
  onChange?: () => void;
}

export function RowDetail({ row, onChange }: RowDetailProps) {
  const router = useRouter();
  const hasDeposit = row.stage === "DEPOSIT" || row.stage === "BOOKED";
  const [busy, setBusy] = useState<null | "link" | "paid" | "confirm" | "cancel" | "enrich">(null);
  const [status, setStatus] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);
  const [depositLink, setDepositLink] = useState<string | null>(null);
  const [openSurveyId, setOpenSurveyId] = useState<string | null>(null);

  const inCancelWindow =
    row.cancellationDeadline && new Date(row.cancellationDeadline).getTime() > Date.now();

  async function call(path: string, action: typeof busy): Promise<unknown> {
    setBusy(action);
    setStatus(null);
    try {
      const res = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      return data;
    } catch (e) {
      setStatus({ kind: "err", msg: e instanceof Error ? e.message : "Failed" });
      throw e;
    } finally {
      setBusy(null);
    }
  }

  async function sendDepositLink() {
    try {
      const data = (await call(
        `/api/pipeline/${row.id}/send-deposit-link`,
        "link"
      )) as { link: string; mode: string };
      setDepositLink(data.link);
      setStatus({
        kind: "ok",
        msg: data.mode === "stub" ? "Stub link (no Stripe key)" : "Link ready",
      });
    } catch {}
  }

  async function markDepositPaid() {
    try {
      const data = (await call(
        `/api/pipeline/${row.id}/mark-deposit-paid`,
        "paid"
      )) as { survey?: { id: string } };
      setStatus({ kind: "ok", msg: "Deposit recorded — Survey 1 opening" });
      if (data.survey?.id) setOpenSurveyId(data.survey.id);
      onChange?.();
    } catch {}
  }

  async function confirmBooking() {
    try {
      await call(`/api/pipeline/${row.id}/confirm-booking`, "confirm");
      setStatus({ kind: "ok", msg: "Booked" });
      onChange?.();
    } catch {}
  }

  async function cancelBooking() {
    try {
      await call(`/api/pipeline/${row.id}/cancel`, "cancel");
      setStatus({ kind: "ok", msg: "Cancelled + refund issued" });
      onChange?.();
    } catch {}
  }

  async function enrichContact() {
    try {
      const data = (await call(
        `/api/venues/${row.venueId}/enrich?tier=free`,
        "enrich"
      )) as {
        ok: boolean;
        enriched?: boolean;
        reason?: string;
        source?: string;
        fieldsUpdated?: string[];
      };
      if (data.ok && data.enriched && data.fieldsUpdated?.length) {
        setStatus({
          kind: "ok",
          msg: `Filled ${data.fieldsUpdated.join(", ")} · via ${data.source ?? "scrape"}`,
        });
        onChange?.();
      } else if (data.ok && data.reason === "venue already populated") {
        setStatus({ kind: "ok", msg: "Already populated" });
      } else {
        // No contact / no website / no match — informational miss, not a success.
        setStatus({ kind: "err", msg: data.reason ?? "No contact found" });
      }
    } catch {}
  }

  return (
    <div className="grid grid-cols-3 gap-0 divide-x divide-border bg-surface border-t border-border">
      <div className="p-4">
        <p className="text-xs font-medium text-text-light uppercase tracking-wide mb-3">Offer</p>
        <div className="space-y-2">
          <div className="flex items-start gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-success-green mt-1.5 shrink-0" />
            <p className="text-sm text-text">50% deposit holds the date</p>
          </div>
          <div className="flex items-start gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-success-green mt-1.5 shrink-0" />
            <p className="text-sm text-text">Free cancellation within 24 hours — full refund</p>
          </div>
          {row.nearestShowDate && row.nearestShowCity && row.distanceMiles != null && (
            <div className="flex items-start gap-2">
              <MapPin size={12} className="text-text-light mt-1 shrink-0" />
              <p className="text-sm text-text-medium">
                Already confirmed{" "}
                {row.nearestShowName ? `at ${row.nearestShowName}` : `in ${row.nearestShowCity}`}{" "}
                on {formatDate(row.nearestShowDate)} —{" "}
                <span className="text-text">{formatMiles(row.distanceMiles)}</span> away
              </p>
            </div>
          )}
          {/* Suggested pricing — what to charge this venue */}
          {!hasDeposit && row.suggestedFee > 0 && (
            <div className="mt-3 pt-3 border-t border-border">
              <div className="flex items-baseline justify-between">
                <span className="text-xs text-text-light uppercase tracking-wide">Suggested fee</span>
                <span className={`text-[10px] px-1 py-0.5 rounded ${
                  row.priceConfidence === "high" ? "bg-success-green-bg text-success-green" :
                  row.priceConfidence === "medium" ? "bg-amber-bg text-amber" :
                  "bg-surface text-text-light"
                }`}>
                  {row.priceConfidence} confidence
                </span>
              </div>
              <p className="text-base font-semibold text-text mt-0.5">
                ${row.suggestedFee}
                <span className="text-xs font-normal text-text-light ml-1">
                  (${row.suggestedFeeLow}–${row.suggestedFeeHigh})
                </span>
              </p>
              <p className="text-xs text-text-light mt-0.5">
                ${row.suggestedDeposit} deposit · {row.priceReasoning.slice(0, 2).join(", ")}
              </p>
            </div>
          )}
          {hasDeposit && row.depositAmount && (
            <div className="mt-3 pt-3 border-t border-border space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-text-medium">Deposit paid</span>
                <span className="text-text font-medium">
                  {formatCurrency(row.depositAmount)}
                </span>
              </div>
              {row.cancellationDeadline && row.stage === "DEPOSIT" && (
                <div className="flex justify-between text-xs">
                  <span className="text-text-light flex items-center gap-1">
                    <Clock size={11} />
                    Cancel window
                  </span>
                  <span className="text-amber font-medium">
                    {timeUntilDeadline(row.cancellationDeadline)} left
                  </span>
                </div>
              )}
              {row.bookedShowFee && (
                <div className="flex justify-between text-sm">
                  <span className="text-text-medium">Total fee</span>
                  <span className="text-text font-medium">
                    {formatCurrency(row.bookedShowFee)}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="p-4">
        <p className="text-xs font-medium text-text-light uppercase tracking-wide mb-3">Contact</p>
        <div className="space-y-2">
          {(row.decisionMakerName || row.decisionMakerRole) && (
            <div className="flex items-center gap-2">
              <User size={13} className="text-text-light shrink-0" />
              <div>
                <p className="text-sm text-text">
                  {row.decisionMakerName ?? row.decisionMakerRole}
                </p>
                {row.decisionMakerName && row.decisionMakerRole && (
                  <p className="text-xs text-text-light">{row.decisionMakerRole}</p>
                )}
              </div>
            </div>
          )}
          {(row.decisionMakerPhone ?? row.venuePhone) && (
            <div className="flex items-center gap-2">
              <Phone size={13} className="text-text-light shrink-0" />
              <a
                href={`tel:${row.decisionMakerPhone ?? row.venuePhone}`}
                className="text-sm text-accent-blue hover:underline"
              >
                {row.decisionMakerPhone ?? row.venuePhone}
              </a>
            </div>
          )}
          {(row.decisionMakerEmail ?? row.venueEmail) && (
            <div className="flex items-center gap-2">
              <Mail size={13} className="text-text-light shrink-0" />
              <a
                href={`mailto:${row.decisionMakerEmail ?? row.venueEmail}`}
                className="text-sm text-accent-blue hover:underline truncate"
              >
                {row.decisionMakerEmail ?? row.venueEmail}
              </a>
            </div>
          )}
          {row.notes && (
            <p className="text-xs text-text-medium mt-2 pt-2 border-t border-border">
              {row.notes}
            </p>
          )}
        </div>
      </div>

      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-medium text-text-light uppercase tracking-wide">Actions</p>
          {status && (
            <span
              className={`flex items-center gap-1 text-xs ${
                status.kind === "ok" ? "text-success-green" : "text-amber"
              }`}
            >
              {status.kind === "ok" ? <Check size={11} /> : <AlertCircle size={11} />}
              {status.msg}
            </span>
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <Button
            variant="default"
            size="sm"
            className="justify-start w-full"
            onClick={() => router.push("/outreach")}
          >
            <Mail size={13} />
            Draft Email
          </Button>
          <Button
            variant="default"
            size="sm"
            className="justify-start w-full"
            onClick={() => router.push("/voice")}
          >
            <FileText size={13} />
            View Script
          </Button>

          {(!row.decisionMakerName || !row.decisionMakerEmail) && (
            <Button
              variant="default"
              size="sm"
              className="justify-start w-full"
              onClick={enrichContact}
              disabled={busy !== null}
              title="Scrape venue website for booking@/events@. Free."
            >
              {busy === "enrich" ? <Loader2 size={13} className="animate-spin" /> : <UserSearch size={13} />}
              Enrich from website
            </Button>
          )}

          {(row.stage === "INTERESTED" || row.stage === "EMAILED" || row.stage === "CALLED") && (
            <>
              <Button
                variant="default"
                size="sm"
                className="justify-start w-full"
                onClick={sendDepositLink}
                disabled={busy !== null}
              >
                {busy === "link" ? <Loader2 size={13} className="animate-spin" /> : <LinkIcon size={13} />}
                Send deposit link
              </Button>
              {depositLink && (
                <div className="text-xs bg-background border border-border rounded p-2 flex items-center gap-1.5">
                  <code className="truncate flex-1 text-text-medium">{depositLink}</code>
                  <button
                    type="button"
                    onClick={() => navigator.clipboard.writeText(depositLink)}
                    className="text-text-light hover:text-text shrink-0"
                    title="Copy"
                  >
                    <Copy size={11} />
                  </button>
                </div>
              )}
              <Button
                variant="default"
                size="sm"
                className="justify-start w-full"
                onClick={markDepositPaid}
                disabled={busy !== null}
                title="Simulate Stripe webhook: marks paid, opens 24h window, fires Survey 1"
              >
                {busy === "paid" ? <Loader2 size={13} className="animate-spin" /> : <DollarSign size={13} />}
                Mark deposit paid (simulate)
              </Button>
            </>
          )}

          {row.stage === "DEPOSIT" && (
            <>
              {inCancelWindow ? (
                <Button
                  variant="default"
                  size="sm"
                  className="justify-start w-full"
                  onClick={cancelBooking}
                  disabled={busy !== null}
                >
                  {busy === "cancel" ? <Loader2 size={13} className="animate-spin" /> : <X size={13} />}
                  Cancel + refund
                </Button>
              ) : (
                <Button
                  variant="primary"
                  size="sm"
                  className="justify-start w-full"
                  onClick={confirmBooking}
                  disabled={busy !== null}
                >
                  {busy === "confirm" ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                  Confirm booking
                </Button>
              )}
            </>
          )}

          {(row.stage === "BOOKED" || row.stage === "DEPOSIT") && (
            <Button
              variant="default"
              size="sm"
              className="justify-start w-full"
              onClick={() => router.push("/surveys")}
            >
              <ClipboardList size={13} />
              Open surveys
            </Button>
          )}
        </div>
      </div>

      {openSurveyId && (
        <SurveyModal
          surveyId={openSurveyId}
          surveyType="POST_BOOKING"
          venueName={row.venueName}
          onClose={() => setOpenSurveyId(null)}
          onSubmitted={() => {
            setOpenSurveyId(null);
            onChange?.();
          }}
        />
      )}
    </div>
  );
}
