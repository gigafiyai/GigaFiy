import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@gigify/db";
import { buildAgreement, type SettleMethod } from "@/lib/agreement";
import { apiHandler } from "@/lib/api-handler";

export const dynamic = "force-dynamic";

async function loadContext(pipelineId: string) {
  const pipeline = await prisma.pipeline.findUnique({
    where: { id: pipelineId },
    include: { venue: true, artist: true, agreement: true },
  });
  return pipeline;
}

// GET ?pipelineId= → preview the agreement for both settle methods.
export async function GET(req: NextRequest) {
  const pipelineId = req.nextUrl.searchParams.get("pipelineId");
  if (!pipelineId) return NextResponse.json({ error: "pipelineId required" }, { status: 400 });
  const p = await loadContext(pipelineId);
  if (!p) return NextResponse.json({ error: "booking not found" }, { status: 404 });

  const base = {
    artistName: p.artist.name,
    venueName: p.venue.name,
    venueCity: `${p.venue.city}, ${p.venue.state}`,
    date: p.bookedShowDate ? p.bookedShowDate.toISOString().slice(0, 10) : null,
    gigFee: p.bookedShowFee,
  };

  return NextResponse.json({
    ok: true,
    alreadyAccepted: !!p.agreement,
    deposit: buildAgreement({ ...base, settleMethod: "deposit" }),
    cash: buildAgreement({ ...base, settleMethod: "cash" }),
  });
}

const Body = z.object({
  pipelineId: z.string(),
  settleMethod: z.enum(["deposit", "cash"]),
  acceptedByName: z.string().min(1),
  acceptedByEmail: z.string().email(),
  startTime: z.string().optional(),
});

// POST → accept the agreement (clickwrap). Cash → BOOKED now; deposit → return
// the deposit checkout link (pipeline advances to DEPOSIT when payment confirms).
export const POST = apiHandler({
  schema: Body,
  handler: async ({ pipelineId, settleMethod, acceptedByName, acceptedByEmail, startTime }) => {
    const p = await loadContext(pipelineId);
    if (!p) return NextResponse.json({ error: "booking not found" }, { status: 404 });
    if (p.agreement) return NextResponse.json({ error: "already accepted" }, { status: 409 });

    const agreement = buildAgreement({
      artistName: p.artist.name,
      venueName: p.venue.name,
      venueCity: `${p.venue.city}, ${p.venue.state}`,
      date: p.bookedShowDate ? p.bookedShowDate.toISOString().slice(0, 10) : null,
      startTime: startTime ?? null,
      gigFee: p.bookedShowFee,
      settleMethod: settleMethod as SettleMethod,
    });

    await prisma.bookingAgreement.create({
      data: {
        pipelineId: p.id,
        venueId: p.venueId,
        artistId: p.artistId,
        showDate: p.bookedShowDate,
        startTime: startTime ?? null,
        gigFee: p.bookedShowFee,
        depositAmount: agreement.depositAmount,
        gigifyFee: agreement.gigifyFee,
        settleMethod,
        terms: agreement.terms,
        acceptedByName,
        acceptedByEmail,
      },
    });

    await prisma.pipeline.update({
      where: { id: p.id },
      data: {
        contractSignedAt: new Date(),
        // Cash bookings are locked immediately; deposit bookings lock on payment.
        ...(settleMethod === "cash" ? { stage: "BOOKED" } : {}),
      },
    });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    return {
      ok: true,
      settleMethod,
      agreement,
      // Deposit path → send them to checkout to pay the hold.
      depositLink: settleMethod === "deposit" ? `${appUrl}/checkout/${p.id}` : null,
      booked: settleMethod === "cash",
    };
  },
});
