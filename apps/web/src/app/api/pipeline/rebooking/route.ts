import { NextResponse } from "next/server";
import { prisma } from "@gigify/db";

export const dynamic = "force-dynamic";

// Repeat booking flywheel: finds venues that completed a show (stage=BOOKED,
// bookedShowDate in the past) and haven't had a follow-up outreach in 90+ days.
// Creates a new QUEUED pipeline row so they enter the next campaign cycle.

const REBOOK_DAYS = 90; // reach out 90 days after the show

export async function POST() {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - REBOOK_DAYS);

  const booked = await prisma.pipeline.findMany({
    where: {
      stage: "BOOKED",
      bookedShowDate: { lte: cutoff },
    },
    include: { venue: true },
  });

  let queued = 0;
  const rebookIds: string[] = [];

  for (const p of booked) {
    // Check if there's already a follow-up pipeline row (avoid double-creating).
    const existing = await prisma.pipeline.count({
      where: {
        venueId: p.venueId,
        id: { not: p.id },
        stage: { in: ["QUEUED", "EMAILED", "INTERESTED"] },
      },
    });
    if (existing > 0) continue;

    // Create a fresh pipeline row for the next campaign.
    await prisma.pipeline.create({
      data: {
        venueId: p.venueId,
        artistId: p.artistId,
        stage: "QUEUED",
        notes: `Re-booking follow-up — previously booked ${p.bookedShowDate?.toLocaleDateString("en-US") ?? "unknown date"} · fee was $${p.bookedShowFee ?? "unknown"}`,
      },
    });

    // Also create a QUEUED outreach so the email engine picks it up.
    await prisma.outreach.create({
      data: {
        venueId: p.venueId,
        artistId: p.artistId,
        channel: "EMAIL",
        status: "QUEUED",
        variant: "rebook",
      },
    });

    queued++;
    rebookIds.push(p.venueId);
  }

  return NextResponse.json({
    ok: true,
    rebookedVenues: queued,
    eligibleToRebook: booked.length,
    venueIds: rebookIds,
  });
}

export async function GET() {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - REBOOK_DAYS);

  const eligible = await prisma.pipeline.count({
    where: {
      stage: "BOOKED",
      bookedShowDate: { lte: cutoff },
    },
  });

  return NextResponse.json({ eligible });
}
