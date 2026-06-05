import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@gigify/db";
import { analyzeCall } from "@/lib/call-analyzer";
import { sendEmail } from "@/lib/sendgrid";
import { slugify } from "@/lib/utils";
import type { CallStatus } from "@gigify/db";

type AgreedTerms = {
  agreedToBook?: boolean;
  agreedDate?: string;   // YYYY-MM-DD
  agreedTime?: string;
  agreedPrice?: number;
  contactEmail?: string;
  contactName?: string;
  venueBookedThrough?: string;
};

function parseDate(s: string | undefined): Date | null {
  if (!s) return null;
  const d = new Date(s.length === 10 ? s + "T00:00:00" : s);
  return isNaN(d.getTime()) ? null : d;
}

export const dynamic = "force-dynamic";

// Vapi end-of-call webhook. When a Tulio call finishes, Vapi POSTs a report
// with the transcript, recording, and outcome. We correlate it to the Call row
// (by Vapi call id, falling back to metadata.venueId), then run it through the
// call-analyzer to score the call (A-D tier, sentiment, next action) and
// capture any email/contact the venue gave — the data-moat loop.

function mapStatus(endedReason: string | undefined): CallStatus {
  const r = (endedReason ?? "").toLowerCase();
  if (r.includes("voicemail")) return "VOICEMAIL";
  if (r.includes("no-answer") || r.includes("did-not-answer") || r.includes("no_answer")) return "NO_ANSWER";
  if (r.includes("error") || r.includes("failed")) return "FAILED";
  return "ANSWERED";
}

// Vapi nests payload fields in a few places depending on event; read defensively.
function pick<T>(...vals: (T | undefined | null)[]): T | null {
  for (const v of vals) if (v !== undefined && v !== null) return v;
  return null;
}

export async function POST(req: NextRequest) {
  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }

  const msg = payload?.message ?? payload;
  const type: string = msg?.type ?? "";
  const liveCallId: string | null = pick(msg?.call?.id, payload?.call?.id, msg?.callId);

  // ── Live status updates — drive the Call Cockpit in real time ──
  if (type === "status-update") {
    const vStatus = (msg?.status ?? "").toLowerCase();
    const mapped = vStatus.includes("in-progress") || vStatus.includes("answered")
      ? "ANSWERED"
      : vStatus.includes("ringing") || vStatus.includes("queued")
      ? "INITIATED"
      : null;
    if (mapped && liveCallId) {
      await prisma.call.updateMany({ where: { vapiCallId: liveCallId }, data: { status: mapped as CallStatus } });
    }
    return NextResponse.json({ ok: true, status: vStatus });
  }

  // ── Live transcript chunks — append final lines so the cockpit can stream ──
  if (type === "transcript") {
    const tType = (msg?.transcriptType ?? "").toLowerCase();
    const role = msg?.role === "assistant" || msg?.role === "bot" ? "Tulio" : "Venue";
    const text: string = msg?.transcript ?? "";
    if (tType === "final" && text.trim() && liveCallId) {
      const existing = await prisma.call.findFirst({ where: { vapiCallId: liveCallId }, select: { id: true, transcript: true } });
      if (existing) {
        const appended = `${existing.transcript ? existing.transcript + "\n" : ""}${role}: ${text.trim()}`;
        await prisma.call.update({ where: { id: existing.id }, data: { transcript: appended } });
      }
    }
    return NextResponse.json({ ok: true });
  }

  // Everything else except the end-of-call report — just ack.
  if (type && type !== "end-of-call-report") {
    return NextResponse.json({ ok: true, ignored: type });
  }

  const vapiCallId: string | null = liveCallId;
  const metaVenueId: string | null = pick(msg?.call?.metadata?.venueId, msg?.metadata?.venueId, payload?.metadata?.venueId);

  const transcript: string =
    pick<string>(msg?.artifact?.transcript, msg?.transcript, payload?.transcript) ?? "";
  const recordingUrl: string | null = pick(
    msg?.artifact?.recordingUrl,
    msg?.recordingUrl,
    msg?.artifact?.recording?.url
  );
  const durationSeconds: number | null = pick(msg?.durationSeconds, msg?.call?.durationSeconds);
  const endedReason: string | undefined = pick(msg?.endedReason, msg?.call?.endedReason) ?? undefined;

  // Find the Call row: prefer the Vapi id, else the most recent INITIATED call
  // for the venue from metadata.
  let call = vapiCallId
    ? await prisma.call.findFirst({ where: { vapiCallId }, include: { venue: true, artist: true } })
    : null;
  if (!call && metaVenueId) {
    call = await prisma.call.findFirst({
      where: { venueId: metaVenueId, status: "INITIATED" },
      orderBy: { calledAt: "desc" },
      include: { venue: true, artist: true },
    });
  }
  if (!call) {
    // Nothing to attach to — ack so Vapi doesn't retry forever.
    return NextResponse.json({ ok: true, note: "no matching call row" });
  }

  const status = mapStatus(endedReason);

  // Structured terms Tulio closed on (Vapi extracts these per our schema).
  const terms: AgreedTerms = pick(msg?.analysis?.structuredData, payload?.analysis?.structuredData) ?? {};

  // Analyze (Claude if configured, heuristic fallback otherwise).
  const analysis = await analyzeCall({
    venueName: call.venue.name,
    artistName: call.artist.name,
    transcript,
    callStatus: status,
  });

  const agreedDate = parseDate(terms.agreedDate);
  const capturedEmail = terms.contactEmail?.trim() || analysis.emailCaptured || null;
  const capturedName = terms.contactName?.trim() || analysis.contactNameCaptured || null;
  // A real close: they agreed AND we have a date and an email to send the link to.
  const closed = !!(terms.agreedToBook && agreedDate && capturedEmail);

  await prisma.call.update({
    where: { id: call.id },
    data: {
      status,
      transcript: transcript || null,
      recordingUrl: recordingUrl ?? undefined,
      durationSeconds: durationSeconds ?? undefined,
      summary: analysis.summary,
      sentiment: analysis.sentiment,
      callScore: analysis.callScore,
      callTier: analysis.callTier,
      nextAction: analysis.nextAction,
      contactNameCaptured: capturedName ?? undefined,
      agreedToBook: !!terms.agreedToBook,
      agreedDate: agreedDate ?? undefined,
      agreedTime: terms.agreedTime?.trim() || undefined,
      agreedPrice: terms.agreedPrice && terms.agreedPrice > 0 ? terms.agreedPrice : undefined,
      emailCaptured: capturedEmail ?? undefined,
      venueBookedThrough: terms.venueBookedThrough?.trim() || undefined,
    },
  });

  // Capture the email onto the venue if we didn't have one.
  if (capturedEmail && !call.venue.email && !call.venue.decisionMakerEmail) {
    await prisma.venue.update({ where: { id: call.venueId }, data: { email: capturedEmail } });
  }

  // ── Auto-send the booking link with the exact terms agreed on the call ──
  let proposalSent = false;
  if (closed) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const iso = agreedDate!.toISOString().slice(0, 10);
    const params = new URLSearchParams({ ref: call.venueId, date: iso });
    if (terms.agreedTime?.trim()) params.set("time", terms.agreedTime.trim());
    if (terms.agreedPrice && terms.agreedPrice > 0) params.set("price", String(Math.round(terms.agreedPrice)));
    const bookingLink = `${appUrl}/${slugify(call.artist.name)}?${params.toString()}`;

    const prettyDate = agreedDate!.toLocaleDateString("en-US", {
      weekday: "long", month: "long", day: "numeric", timeZone: "UTC",
    });
    const timeLine = terms.agreedTime?.trim() ? ` at ${terms.agreedTime.trim()}` : "";
    const priceLine = terms.agreedPrice && terms.agreedPrice > 0 ? ` for $${Math.round(terms.agreedPrice)}` : "";
    const greeting = capturedName ? `Hi ${capturedName.split(" ")[0]},` : "Hi,";

    const body =
      `${greeting}\n\n` +
      `Great speaking with you just now. As discussed, here's the link to lock in ${call.artist.name} ` +
      `on ${prettyDate}${timeLine}${priceLine}.\n\n` +
      `Put the deposit down here to hold the date:\n${bookingLink}\n\n` +
      `Reminder: you've got a full 24-hour window to cancel for a 100% refund if anything changes — ` +
      `so there's no risk in locking it now while the date is open.\n\n` +
      `Looking forward to it,\n${call.artist.bookingAgentName || "Tulio"}\n${call.artist.name} · Gigify Booking`;

    const delivery = await sendEmail({
      to: capturedEmail!,
      subject: `Booking link — ${call.artist.name} on ${prettyDate}`,
      text: body,
      replyTo: call.artist.contactEmail,
      footer: {
        artistName: call.artist.name,
        mailingAddress: call.artist.mailingAddress,
        unsubscribeVenueId: call.venueId,
      },
    });
    proposalSent = delivery.delivered;

    if (proposalSent) {
      await prisma.call.update({ where: { id: call.id }, data: { proposalSentAt: new Date() } });
      // Advance the pipeline — this is a hot, verbally-agreed lead.
      await prisma.pipeline.updateMany({
        where: { venueId: call.venueId },
        data: { stage: "INTERESTED" },
      });
    }
  }

  return NextResponse.json({
    ok: true,
    callId: call.id,
    status,
    callTier: analysis.callTier,
    callScore: analysis.callScore,
    closed,
    proposalSent,
  });
}
