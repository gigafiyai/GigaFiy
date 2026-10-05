import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@gigify/db";
import { buildAgreement, type SettleMethod } from "@/lib/agreement";
import { apiHandler } from "@/lib/api-handler";
import { createVenueAccount, venueAccountByToken } from "@/lib/venue-accounts";

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
  venueToken: z.string().max(64).optional(), // the venue confirming from its own workspace
  openNightId: z.string().max(64).optional(), // confirming a night the venue posted
});

// POST → accept the agreement (clickwrap). Cash → BOOKED now; deposit → return
// the deposit checkout link (pipeline advances to DEPOSIT when payment confirms).
export const POST = apiHandler({
  schema: Body,
  handler: async ({ pipelineId, settleMethod, acceptedByName, acceptedByEmail, startTime, venueToken, openNightId }) => {
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

    // Put the booking in a venue workspace: the venue's own (it came from its
    // workspace link), the one that posted this night, or a new one.
    const night = openNightId
      ? await prisma.openNight.findUnique({ where: { id: openNightId }, include: { venueAccount: true } })
      : null;
    const fromToken = venueToken ? await venueAccountByToken(venueToken) : null;
    const existingAccount = fromToken ?? night?.venueAccount ?? null;
    const account =
      existingAccount ??
      (await createVenueAccount({
        name: p.venue.name,
        city: [p.venue.city, p.venue.state].filter(Boolean).join(", "),
        email: acceptedByEmail,
        contactName: acceptedByName,
      }));
    if (night && night.status === "open") {
      await prisma.openNight.update({ where: { id: night.id }, data: { status: "filled" } });
    }

    await prisma.bookingAgreement.create({
      data: {
        venueAccountId: account.id,
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
      // Only shown to someone who just created the workspace or already holds
      // its link — never to a visitor who arrived via a posted night.
      venuePageUrl: !existingAccount || fromToken ? `${appUrl}/venue/${account.accessToken}` : null,
    };
  },
});
