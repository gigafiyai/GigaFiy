import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@gigify/db";
import { analyzeCall } from "@/lib/call-analyzer";
import type { CallStatus } from "@gigify/db";

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

  // We only act on the end-of-call report. Ack everything else so Vapi is happy.
  if (type && type !== "end-of-call-report") {
    return NextResponse.json({ ok: true, ignored: type });
  }

  const vapiCallId: string | null = pick(msg?.call?.id, payload?.call?.id, msg?.callId);
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

  // Analyze (Claude if configured, heuristic fallback otherwise).
  const analysis = await analyzeCall({
    venueName: call.venue.name,
    artistName: call.artist.name,
    transcript,
    callStatus: status,
  });

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
      contactNameCaptured: analysis.contactNameCaptured ?? undefined,
      analyzedAt: new Date(),
    },
  });

  // If the venue gave an email on the call and we don't have one, capture it.
  if (analysis.emailCaptured && !call.venue.email && !call.venue.decisionMakerEmail) {
    await prisma.venue.update({
      where: { id: call.venueId },
      data: { email: analysis.emailCaptured },
    });
  }

  return NextResponse.json({
    ok: true,
    callId: call.id,
    status,
    callTier: analysis.callTier,
    callScore: analysis.callScore,
  });
}
