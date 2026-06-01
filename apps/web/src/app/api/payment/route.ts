import { NextResponse } from "next/server";
import { prisma } from "@gigify/db";

export const dynamic = "force-dynamic";

// Returns deposit + booking activity for the Payment page.
export async function GET() {
  const pipelines = await prisma.pipeline.findMany({
    where: { stage: { in: ["DEPOSIT", "BOOKED", "CANCELLED"] } },
    include: { venue: true },
    orderBy: { depositPaidAt: "desc" },
  });

  const now = Date.now();
  const rows = pipelines.map((p) => {
    const deadline = p.cancellationDeadline?.getTime() ?? null;
    const msRemaining = deadline ? Math.max(0, deadline - now) : null;
    return {
      pipelineId: p.id,
      venueId: p.venueId,
      venueName: p.venue.name,
      city: p.venue.city,
      state: p.venue.state,
      stage: p.stage,
      depositAmount: p.depositAmount,
      depositPaidAt: p.depositPaidAt?.toISOString() ?? null,
      cancellationDeadline: p.cancellationDeadline?.toISOString() ?? null,
      cancelledAt: p.cancelledAt?.toISOString() ?? null,
      refundIssuedAt: p.refundIssuedAt?.toISOString() ?? null,
      bookedShowDate: p.bookedShowDate?.toISOString().slice(0, 10) ?? null,
      bookedShowFee: p.bookedShowFee,
      msRemainingInWindow: msRemaining,
      withinWindow: msRemaining !== null && msRemaining > 0,
    };
  });

  const totals = {
    depositsCollected: rows
      .filter((r) => r.stage === "DEPOSIT" || r.stage === "BOOKED")
      .reduce((s, r) => s + (r.depositAmount ?? 0), 0),
    revenueBooked: rows
      .filter((r) => r.stage === "BOOKED")
      .reduce((s, r) => s + (r.bookedShowFee ?? 0), 0),
    refundsIssued: rows
      .filter((r) => r.stage === "CANCELLED")
      .reduce((s, r) => s + (r.depositAmount ?? 0), 0),
    gigifyTake: 0,
  };
  totals.gigifyTake = Math.round(totals.revenueBooked * 0.12);

  return NextResponse.json({ rows, totals });
}
