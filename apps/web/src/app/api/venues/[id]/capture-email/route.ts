import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@gigify/db";

export const dynamic = "force-dynamic";

// Called after an artist manually calls a venue and captures a contact email.
// Updates the venue, advances the pipeline, logs a Call record, and triggers
// the outreach email send.

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { contactEmail, contactName, contactPhone, notes } = (await req.json()) as {
    contactEmail?: string;
    contactName?: string;
    contactPhone?: string;
    notes?: string;
  };

  if (!contactEmail) {
    return NextResponse.json({ error: "contactEmail required" }, { status: 400 });
  }

  const venue = await prisma.venue.findUnique({
    where: { id: params.id },
    include: { pipeline: true, artist: true },
  });
  if (!venue) return NextResponse.json({ error: "venue not found" }, { status: 404 });

  // Update venue with captured contact info.
  const updatedVenue = await prisma.venue.update({
    where: { id: venue.id },
    data: {
      decisionMakerEmail: contactEmail,
      email: contactEmail,
      ...(contactName && { decisionMakerName: contactName }),
      ...(contactPhone && { decisionMakerPhone: contactPhone }),
    },
  });

  // Log the call.
  const call = await prisma.call.create({
    data: {
      venueId: venue.id,
      artistId: venue.artistId,
      status: "ANSWERED",
      scriptVariant: "owner",
      calledAt: new Date(),
      contactNameCaptured: contactName ?? null,
      disposition: "captured_email",
      summary: notes ?? `Artist called and captured email: ${contactEmail}`,
    },
  });

  // Advance pipeline: QUEUED → INTERESTED (they responded, so they're warm).
  if (venue.pipeline && (venue.pipeline.stage === "QUEUED" || venue.pipeline.stage === "EMAILED")) {
    await prisma.pipeline.update({
      where: { id: venue.pipeline.id },
      data: { stage: "INTERESTED", callStatus: "ANSWERED" },
    });
  }

  // Update outreach status if exists.
  await prisma.outreach.updateMany({
    where: { venueId: venue.id, channel: "EMAIL", status: "QUEUED" },
    data: { status: "QUEUED" }, // stays queued — email will be sent next
  });

  return NextResponse.json({
    ok: true,
    callId: call.id,
    email: updatedVenue.decisionMakerEmail,
    readyToEmail: true,
  });
}
