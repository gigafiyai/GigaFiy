"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Check, AlertCircle, Loader2, Copy } from "lucide-react";

type Props = {
  artistId: string;
  artistName: string;
  venueId: string | null;
  prefillName: string | null;
  prefillEmail: string | null;
  prefillVenueName: string | null;
  prefillDate?: string | null;
  prefillTime?: string | null;
  prefillPrice?: string | null;
};

export function BookingForm({
  artistId,
  artistName,
  venueId,
  prefillName,
  prefillEmail,
  prefillVenueName,
  prefillDate,
  prefillTime,
  prefillPrice,
}: Props) {
  const [contactName, setContactName] = useState(prefillName ?? "");
  const [contactEmail, setContactEmail] = useState(prefillEmail ?? "");
  const [venueName, setVenueName] = useState(prefillVenueName ?? "");
  const [city, setCity] = useState("");
  const [requestedDate, setRequestedDate] = useState(prefillDate ?? "");
  const [fee, setFee] = useState(prefillPrice ?? "");
  // Seed notes with the agreed start time so it carries into the booking.
  const [notes, setNotes] = useState(prefillTime ? `Agreed start time: ${prefillTime}` : "");
  const [phoneConsent, setPhoneConsent] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ pipelineId: string; depositLink: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Agreement step
  type Agreement = { title: string; summary: string; terms: string[]; gigFee: number | null; gigifyFee: number; depositAmount: number };
  const [agreement, setAgreement] = useState<{ deposit: Agreement; cash: Agreement } | null>(null);
  const [settleMethod, setSettleMethod] = useState<"deposit" | "cash">("deposit");
  const [showTerms, setShowTerms] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [booked, setBooked] = useState(false);

  const required = contactName && contactEmail && (venueId || (venueName && city));

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/bookings/initiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          artistId, venueId, venueName: venueName || prefillVenueName, city,
          contactName, contactEmail,
          requestedShowDate: requestedDate || null,
          fee: fee ? Number(fee) : null,
          notes: notes || null,
          phoneConsent,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setResult({ pipelineId: data.pipelineId, depositLink: data.depositLink });
      // Load the performance agreement for the confirmation step.
      const ag = await fetch(`/api/bookings/agreement?pipelineId=${data.pipelineId}`).then((r) => r.json());
      if (ag.ok) setAgreement({ deposit: ag.deposit, cash: ag.cash });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Submit failed");
    } finally {
      setSubmitting(false);
    }
  }

  async function accept() {
    if (!result || !agreed) return;
    setAccepting(true);
    try {
      const res = await fetch("/api/bookings/agreement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pipelineId: result.pipelineId, settleMethod,
          acceptedByName: contactName, acceptedByEmail: contactEmail,
          startTime: prefillTime || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      if (data.depositLink) { window.location.href = data.depositLink; return; }
      if (data.booked) setBooked(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setAccepting(false);
    }
  }

  if (booked) {
    return (
      <div className="border border-success-green/20 bg-success-green-bg rounded-lg p-6 text-center space-y-2">
        <Check size={28} className="text-success-green mx-auto" />
        <p className="text-base font-medium text-success-green">You're booked! 🎉</p>
        <p className="text-sm text-text-medium">
          The agreement is confirmed and you'll settle in cash on the night. You can cancel within 24 hours for free if anything changes.
        </p>
      </div>
    );
  }

  if (result) {
    const a = agreement ? agreement[settleMethod] : null;
    return (
      <div className="border border-border bg-background rounded-lg p-5 space-y-4">
        <div className="flex items-center gap-2 text-success-green">
          <Check size={16} />
          <p className="text-sm font-medium">Almost there — confirm the agreement to lock it in.</p>
        </div>

        {/* Settle method */}
        <div>
          <p className="text-xs uppercase tracking-wide text-text-light mb-1.5">How would you like to settle?</p>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setSettleMethod("deposit")}
              className={`text-left border rounded-lg p-3 transition ${settleMethod === "deposit" ? "border-accent-blue bg-accent-blue-bg" : "border-border hover:bg-surface"}`}>
              <div className="text-sm font-medium text-text">Pay 50% deposit</div>
              <div className="text-xs text-text-light mt-0.5">Recommended · holds the date now{a ? ` · $${agreement!.deposit.depositAmount}` : ""}</div>
            </button>
            <button type="button" onClick={() => setSettleMethod("cash")}
              className={`text-left border rounded-lg p-3 transition ${settleMethod === "cash" ? "border-accent-blue bg-accent-blue-bg" : "border-border hover:bg-surface"}`}>
              <div className="text-sm font-medium text-text">Settle in cash</div>
              <div className="text-xs text-text-light mt-0.5">Pay the artist on the night</div>
            </button>
          </div>
        </div>

        {/* Agreement */}
        {a && (
          <div className="border border-border rounded-lg bg-surface p-3">
            <p className="text-sm text-text">{a.summary}</p>
            <p className="text-xs text-text-light mt-1">Gigify booking fee: ${a.gigifyFee} · {settleMethod === "deposit" ? `${a.depositAmount} deposit holds the date` : "cash on the night"}</p>
            <button type="button" onClick={() => setShowTerms((s) => !s)} className="text-xs text-accent-blue mt-1.5">
              {showTerms ? "Hide" : "View"} agreement terms
            </button>
            {showTerms && (
              <ul className="mt-2 space-y-1.5 border-t border-border pt-2">
                {a.terms.map((t, i) => <li key={i} className="text-xs text-text-medium leading-snug">{i + 1}. {t}</li>)}
              </ul>
            )}
          </div>
        )}

        <label className="flex items-start gap-2 text-sm text-text-medium cursor-pointer">
          <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-0.5" />
          I, {contactName || "the venue contact"}, agree to the performance agreement above.
        </label>

        {error && <p className="text-xs text-amber flex items-center gap-1"><AlertCircle size={12} /> {error}</p>}

        <button type="button" onClick={accept} disabled={!agreed || accepting}
          className="w-full bg-accent-blue text-white text-center py-3 rounded-md font-medium hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2">
          {accepting ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
          {settleMethod === "deposit" ? "Agree & pay deposit →" : "Agree & confirm booking"}
        </button>

        <div className="hidden items-center gap-2 text-xs text-text-light">
          <code className="truncate flex-1">{result.depositLink}</code>
          <button
            type="button"
            onClick={() => navigator.clipboard.writeText(result.depositLink)}
            className="hover:text-text"
            aria-label="Copy link"
          >
            <Copy size={12} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="border border-border rounded-lg p-5 space-y-4 bg-background">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs uppercase tracking-wide text-text-light">
            Your name
          </label>
          <Input
            value={contactName}
            onChange={(e) => setContactName(e.target.value)}
            className="mt-1"
            placeholder="e.g. Sarah Chen"
          />
        </div>
        <div>
          <label className="text-xs uppercase tracking-wide text-text-light">
            Email
          </label>
          <Input
            type="email"
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
            className="mt-1"
            placeholder="you@venue.com"
          />
        </div>
        <div>
          <label className="text-xs uppercase tracking-wide text-text-light">
            Venue name
          </label>
          <Input
            value={venueName}
            onChange={(e) => setVenueName(e.target.value)}
            className="mt-1"
            placeholder="The Hideout"
            disabled={!!venueId}
          />
        </div>
        <div>
          <label className="text-xs uppercase tracking-wide text-text-light">
            City
          </label>
          <Input
            value={city}
            onChange={(e) => setCity(e.target.value)}
            className="mt-1"
            placeholder="Ann Arbor, MI"
            disabled={!!venueId}
          />
        </div>
        <div>
          <label className="text-xs uppercase tracking-wide text-text-light">
            Requested date (optional)
          </label>
          <Input
            type="date"
            value={requestedDate}
            onChange={(e) => setRequestedDate(e.target.value)}
            className="mt-1"
          />
        </div>
        <div>
          <label className="text-xs uppercase tracking-wide text-text-light">
            Fee offered ($) — optional
          </label>
          <Input
            type="number"
            value={fee}
            onChange={(e) => setFee(e.target.value)}
            className="mt-1"
            placeholder="600"
          />
        </div>
        <div className="col-span-2">
          <label className="text-xs uppercase tracking-wide text-text-light">
            Anything else?
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="mt-1 w-full px-3 py-2 text-sm bg-elevated border border-border rounded-md text-text focus:outline-none focus:border-accent-blue resize-y"
            placeholder="Set length, load-in details, anything we should know"
          />
        </div>
      </div>

      <label className="flex items-start gap-2 text-xs text-text-medium cursor-pointer">
        <input type="checkbox" checked={phoneConsent} onChange={(e) => setPhoneConsent(e.target.checked)} className="mt-0.5" />
        It&rsquo;s OK to contact me by phone about this booking.
      </label>

      <p className="text-xs text-text-light">
        Submitting reserves a hold for {artistName} and surfaces a Stripe deposit
        link. You can cancel within 24 hours after payment for a full refund.
      </p>

      <div className="flex items-center justify-between">
        {error ? (
          <span className="flex items-center gap-1 text-xs text-amber">
            <AlertCircle size={12} />
            {error}
          </span>
        ) : (
          <span />
        )}
        <Button variant="primary" size="lg" onClick={submit} disabled={!required || submitting}>
          {submitting ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
          {submitting ? "Holding the date…" : "Request to book"}
        </Button>
      </div>
    </div>
  );
}
