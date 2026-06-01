import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@gigify/db";

export const dynamic = "force-dynamic";

// Simulates the Stripe webhook firing for a paid deposit. Opens the 24h
// cancellation window and creates the Survey 1 row (which must complete
// before the confirmation email per the build guide).
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { depositAmount, bookedShowFee, bookedShowDate } = (await req.json()) as {
    depositAmount?: number;
    bookedShowFee?: number;
    bookedShowDate?: string;
  };

  const pipeline = await prisma.pipeline.findUnique({
    where: { id: params.id },
    include: { venue: true },
  });
  if (!pipeline) return NextResponse.json({ error: "pipeline not found" }, { status: 404 });

  const now = new Date();
  const deadline = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const updated = await prisma.pipeline.update({
    where: { id: pipeline.id },
    data: {
      stage: "DEPOSIT",
      depositAmount: depositAmount ?? 300,
      depositPaidAt: now,
      cancellationDeadline: deadline,
      bookedShowFee: bookedShowFee ?? null,
      bookedShowDate: bookedShowDate ? new Date(bookedShowDate) : null,
      stripePaymentIntentId: `pi_stub_${pipeline.id.slice(0, 10)}`,
    },
  });

  const survey = await prisma.survey.create({
    data: {
      pipelineId: pipeline.id,
      venueId: pipeline.venueId,
      surveyType: "POST_BOOKING",
    },
  });

  return NextResponse.json({
    ok: true,
    pipelineId: updated.id,
    cancellationDeadline: updated.cancellationDeadline?.toISOString(),
    survey: { id: survey.id, type: "POST_BOOKING" },
  });
}
