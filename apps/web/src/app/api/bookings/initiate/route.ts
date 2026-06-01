import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@gigify/db";

export const dynamic = "force-dynamic";

type Body = {
  artistId: string;
  venueId: string | null;
  venueName?: string | null;
  city?: string | null;
  contactName: string;
  contactEmail: string;
  requestedShowDate?: string | null;
  fee?: number | null;
  notes?: string | null;
};

// Public landing-page booking submission. Creates / updates Venue + Pipeline,
// returns a deposit link. The 24h cancellation window opens later, when the
// Stripe webhook confirms payment via mark-deposit-paid.
export async function POST(req: NextRequest) {
  const body = (await req.json()) as Body;

  if (!body.artistId || !body.contactName || !body.contactEmail) {
    return NextResponse.json(
      { error: "artistId, contactName, contactEmail required" },
      { status: 400 }
    );
  }

  const artist = await prisma.artist.findUnique({ where: { id: body.artistId } });
  if (!artist) return NextResponse.json({ error: "artist not found" }, { status: 404 });

  // Resolve / create venue.
  let venue = body.venueId
    ? await prisma.venue.findUnique({ where: { id: body.venueId } })
    : null;

  if (!venue) {
    if (!body.venueName || !body.city) {
      return NextResponse.json(
        { error: "venueName and city required when no venueId" },
        { status: 400 }
      );
    }
    const [city, state] = body.city.split(",").map((s) => s.trim());
    venue = await prisma.venue.create({
      data: {
        name: body.venueName,
        city: city || body.city,
        state: state || "",
        address: body.city,
        lat: 0,
        lng: 0,
        venueType: "OTHER",
        decisionMakerName: body.contactName,
        decisionMakerEmail: body.contactEmail,
        artistId: artist.id,
        source: "landing_page",
      },
    });
  } else {
    // Capture missing contact info from the form.
    const updates: Record<string, string | null> = {};
    if (!venue.decisionMakerName) updates.decisionMakerName = body.contactName;
    if (!venue.decisionMakerEmail) updates.decisionMakerEmail = body.contactEmail;
    if (Object.keys(updates).length > 0) {
      venue = await prisma.venue.update({ where: { id: venue.id }, data: updates });
    }
  }

  // Find or create Pipeline row → INTERESTED.
  let pipeline = await prisma.pipeline.findUnique({ where: { venueId: venue.id } });
  if (!pipeline) {
    pipeline = await prisma.pipeline.create({
      data: {
        venueId: venue.id,
        artistId: artist.id,
        stage: "INTERESTED",
        notes: body.notes ?? null,
        bookedShowFee: body.fee ?? null,
        bookedShowDate: body.requestedShowDate ? new Date(body.requestedShowDate) : null,
      },
    });
  } else {
    pipeline = await prisma.pipeline.update({
      where: { id: pipeline.id },
      data: {
        stage: pipeline.stage === "QUEUED" || pipeline.stage === "EMAILED" || pipeline.stage === "CALLED" ? "INTERESTED" : pipeline.stage,
        notes: body.notes ?? pipeline.notes,
        bookedShowFee: body.fee ?? pipeline.bookedShowFee,
        bookedShowDate: body.requestedShowDate
          ? new Date(body.requestedShowDate)
          : pipeline.bookedShowDate,
      },
    });
  }

  // Mark the originating outreach as REPLIED so it shows on the CRM.
  const outreach = await prisma.outreach.findFirst({
    where: { venueId: venue.id, channel: "EMAIL" },
    orderBy: { createdAt: "desc" },
  });
  if (outreach && outreach.status !== "REPLIED") {
    await prisma.outreach.update({
      where: { id: outreach.id },
      data: { status: "REPLIED" },
    });
  }

  // Generate the deposit link. Real Stripe Checkout will live here once wired.
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3001";
  const depositLink = `${appUrl}/checkout/${pipeline.id}`;

  return NextResponse.json({
    ok: true,
    pipelineId: pipeline.id,
    venueId: venue.id,
    depositLink,
    stripeMode: process.env.STRIPE_SECRET_KEY ? "live" : "stub",
  });
}
