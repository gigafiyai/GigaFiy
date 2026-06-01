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
};

export function BookingForm({
  artistId,
  artistName,
  venueId,
  prefillName,
  prefillEmail,
  prefillVenueName,
}: Props) {
  const [contactName, setContactName] = useState(prefillName ?? "");
  const [contactEmail, setContactEmail] = useState(prefillEmail ?? "");
  const [venueName, setVenueName] = useState(prefillVenueName ?? "");
  const [city, setCity] = useState("");
  const [requestedDate, setRequestedDate] = useState("");
  const [fee, setFee] = useState("");
  const [notes, setNotes] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ depositLink: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const required = contactName && contactEmail && (venueId || (venueName && city));

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/bookings/initiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          artistId,
          venueId,
          venueName: venueName || prefillVenueName,
          city,
          contactName,
          contactEmail,
          requestedShowDate: requestedDate || null,
          fee: fee ? Number(fee) : null,
          notes: notes || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setResult({ depositLink: data.depositLink });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Submit failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (result) {
    return (
      <div className="border border-success-green/20 bg-success-green-bg rounded-lg p-5 space-y-3">
        <div className="flex items-center gap-2 text-success-green">
          <Check size={16} />
          <p className="text-sm font-medium">
            You're locked in — last step is the deposit.
          </p>
        </div>
        <p className="text-sm text-text-medium">
          Tap below to pay 50% and hold the date. The 24-hour cancellation window
          starts the moment payment confirms.
        </p>
        <a
          href={result.depositLink}
          target="_blank"
          rel="noreferrer"
          className="block bg-accent-blue text-white text-center py-3 rounded-md font-medium hover:opacity-90"
        >
          Pay 50% deposit →
        </a>
        <div className="flex items-center gap-2 text-xs text-text-light">
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
            className="mt-1 w-full px-3 py-2 text-sm bg-white border border-border rounded-md text-text focus:outline-none focus:border-accent-blue resize-y"
            placeholder="Set length, load-in details, anything we should know"
          />
        </div>
      </div>

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
