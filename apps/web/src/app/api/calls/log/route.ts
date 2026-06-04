import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@gigify/db";
import { variantForRole } from "@/lib/call-variant";
import { analyzeCall } from "@/lib/call-analyzer";

export const dynamic = "force-dynamic";

type Outcome = "ANSWERED" | "VOICEMAIL" | "NO_ANSWER" | "FAILED";

// Unified call-logging endpoint. Works for:
//   - Manual calls: artist calls, then types what happened in `transcript`
//   - Future Nova calls: Twilio records → Deepgram STT → same transcript field
// It creates the Call row, runs AI analysis (summary, sentiment, A-D rank,
// next action), captures any email mentioned, and advances the pipeline.
export async function POST(req: NextRequest) {
  const { venueId, outcome, transcript, durationSeconds, recordingUrl } =
    (await req.json()) as {
      venueId?: string;
      outcome?: Outcome;
      transcript?: string;
      durationSeconds?: number;
      recordingUrl?: string;
    };

  if (!venueId || !outcome) {
    return NextResponse.json({ error: "venueId and outcome required" }, { status: 400 });
  }

  const venue = await prisma.venue.findUnique({
    where: { id: venueId },
    include: { pipeline: true, artist: true },
  });
  if (!venue) return NextResponse.json({ error: "venue not found" }, { status: 404 });

  const variant = variantForRole(venue.decisionMakerRole);
  const now = new Date();

  // Run AI analysis on the transcript/notes.
  const analysis = await analyzeCall({
    venueName: venue.name,
    artistName: venue.artist.name,
    transcript: transcript ?? "",
    callStatus: outcome,
  });

  const call = await prisma.call.create({
    data: {
      venueId: venue.id,
      artistId: venue.artistId,
      status: outcome,
      scriptVariant: variant,
      calledAt: now,
      durationSeconds: durationSeconds ?? null,
      recordingUrl: recordingUrl ?? null,
      transcript: transcript ?? null,
      summary: analysis.summary,
      sentiment: analysis.sentiment,
      callScore: analysis.callScore,
      callTier: analysis.callTier,
      nextAction: analysis.nextAction,
      contactNameCaptured: analysis.contactNameCaptured,
      analyzedAt: now,
      disposition: outcome === "ANSWERED" ? "spoke_to_decision_maker" : null,
    },
  });

  // If the call captured an email, save it to the venue so the email engine
  // can immediately send the booking link.
  const venueUpdates: Record<string, string> = {};
  if (analysis.emailCaptured && !venue.decisionMakerEmail) {
    venueUpdates.decisionMakerEmail = analysis.emailCaptured;
    venueUpdates.email = analysis.emailCaptured;
  }
  if (analysis.contactNameCaptured && !venue.decisionMakerName) {
    venueUpdates.decisionMakerName = analysis.contactNameCaptured;
  }
  if (Object.keys(venueUpdates).length > 0) {
    await prisma.venue.update({ where: { id: venue.id }, data: venueUpdates });
  }

  // Advance the pipeline based on how the call went.
  if (venue.pipeline) {
    let nextStage = venue.pipeline.stage;
    // A/B tier or captured email → INTERESTED. Otherwise just mark CALLED.
    if (outcome === "ANSWERED" && (analysis.callTier === "A" || analysis.callTier === "B" || analysis.emailCaptured)) {
      nextStage = "INTERESTED";
    } else if (analysis.callTier === "D" && analysis.sentiment === "negative") {
      nextStage = "DECLINED";
    } else if (["VOICEMAIL", "NO_ANSWER", "FAILED", "ANSWERED"].includes(outcome)) {
      nextStage = venue.pipeline.stage === "QUEUED" || venue.pipeline.stage === "EMAILED"
        ? "CALLED"
        : venue.pipeline.stage;
    }

    await prisma.pipeline.update({
      where: { id: venue.pipeline.id },
      data: { stage: nextStage, callStatus: outcome },
    });
  }

  return NextResponse.json({
    ok: true,
    callId: call.id,
    analysis: {
      summary: analysis.summary,
      sentiment: analysis.sentiment,
      callScore: analysis.callScore,
      callTier: analysis.callTier,
      nextAction: analysis.nextAction,
      emailCaptured: analysis.emailCaptured,
      contactNameCaptured: analysis.contactNameCaptured,
    },
  });
}
