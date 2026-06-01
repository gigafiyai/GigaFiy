import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@gigify/db";
import { variantForRole } from "@/lib/call-scripts";

export const dynamic = "force-dynamic";

type Outcome = "ANSWERED" | "VOICEMAIL" | "NO_ANSWER" | "FAILED";

// Simulates a Twilio call result without actually dialing. Creates a Call row
// and advances the pipeline stage based on outcome.
export async function POST(req: NextRequest) {
  const { venueId, outcome, summary, contactNameCaptured } = (await req.json()) as {
    venueId?: string;
    outcome?: Outcome;
    summary?: string;
    contactNameCaptured?: string;
  };
  if (!venueId || !outcome) {
    return NextResponse.json({ error: "venueId and outcome required" }, { status: 400 });
  }

  const venue = await prisma.venue.findUnique({
    where: { id: venueId },
    include: { pipeline: true },
  });
  if (!venue) return NextResponse.json({ error: "venue not found" }, { status: 404 });

  const variant = variantForRole(venue.decisionMakerRole);
  const now = new Date();

  const call = await prisma.call.create({
    data: {
      venueId: venue.id,
      artistId: venue.artistId,
      status: outcome,
      scriptVariant: variant,
      calledAt: now,
      summary: summary ?? null,
      contactNameCaptured: contactNameCaptured ?? null,
      disposition: outcome === "ANSWERED" ? "spoke_to_decision_maker" : null,
    },
  });

  if (venue.pipeline) {
    let nextStage = venue.pipeline.stage;
    if (outcome === "ANSWERED") nextStage = "INTERESTED";
    else if (["VOICEMAIL", "NO_ANSWER", "FAILED"].includes(outcome)) nextStage = "CALLED";

    if (nextStage !== venue.pipeline.stage) {
      await prisma.pipeline.update({
        where: { id: venue.pipeline.id },
        data: { stage: nextStage, callStatus: outcome },
      });
    } else {
      await prisma.pipeline.update({
        where: { id: venue.pipeline.id },
        data: { callStatus: outcome },
      });
    }
  }

  return NextResponse.json({ ok: true, callId: call.id });
}
