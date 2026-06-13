import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@gigify/db";
import { assembleVenueBrief } from "@/lib/assemble-brief";
import { getAuthedArtist } from "@/lib/tenant";

export const dynamic = "force-dynamic";

// Live state of one call — polled by the Call Cockpit. Returns status,
// streaming transcript, the post-call analysis (when done), and the venue +
// Tulio's brief knowledge for the side panel.
//   GET /api/calls/[id]?brief=1
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const artist = await getAuthedArtist();
  if (!artist) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const call = await prisma.call.findFirst({
    where: { id: params.id, artistId: artist.id },
    include: { venue: { select: { id: true, name: true, city: true, state: true, phone: true } } },
  });
  if (!call) return NextResponse.json({ error: "call not found" }, { status: 404 });

  const wantBrief = req.nextUrl.searchParams.get("brief") === "1";
  let brief: { firstLine: string; knowledge: unknown } | null = null;
  if (wantBrief) {
    const assembled = await assembleVenueBrief(call.venueId);
    if (assembled) brief = { firstLine: assembled.brief.firstLine, knowledge: assembled.brief.knowledge };
  }

  // Live only until the end-of-call report runs the analysis.
  const active = !call.analyzedAt && (call.status === "INITIATED" || call.status === "ANSWERED");

  return NextResponse.json({
    ok: true,
    active,
    call: {
      id: call.id,
      status: call.status,
      transcript: call.transcript,
      durationSeconds: call.durationSeconds,
      callScore: call.callScore,
      callTier: call.callTier,
      sentiment: call.sentiment,
      summary: call.summary,
      nextAction: call.nextAction,
      agreedToBook: call.agreedToBook,
      agreedDate: call.agreedDate ? call.agreedDate.toISOString().slice(0, 10) : null,
      agreedTime: call.agreedTime,
      agreedPrice: call.agreedPrice,
      emailCaptured: call.emailCaptured,
      venueBookedThrough: call.venueBookedThrough,
      calledAt: call.calledAt?.toISOString() ?? null,
    },
    venue: call.venue,
    brief,
  });
}
