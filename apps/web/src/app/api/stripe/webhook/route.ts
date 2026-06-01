import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@gigify/db";
import { getStripe } from "@/lib/stripe";

export const dynamic = "force-dynamic";

// Stripe sends events here. We care about checkout.session.completed.
// Configure with:  stripe listen --forward-to localhost:3001/api/stripe/webhook
export async function POST(req: NextRequest) {
  const stripe = getStripe();
  const signature = req.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripe || !webhookSecret || !signature) {
    return NextResponse.json({ error: "stripe not configured" }, { status: 503 });
  }

  const payload = await req.text();
  let event;
  try {
    event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "signature verification failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const pipelineId = session.metadata?.pipelineId;
    if (!pipelineId) {
      return NextResponse.json({ ok: true, ignored: "no pipelineId metadata" });
    }

    const pipeline = await prisma.pipeline.findUnique({ where: { id: pipelineId } });
    if (!pipeline) return NextResponse.json({ ok: true, ignored: "pipeline not found" });

    // Idempotency: if already DEPOSIT or BOOKED, skip.
    if (pipeline.stage === "DEPOSIT" || pipeline.stage === "BOOKED") {
      return NextResponse.json({ ok: true, ignored: "already paid" });
    }

    const now = new Date();
    const deadline = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const amountUsd = session.amount_total ? session.amount_total / 100 : null;

    await prisma.pipeline.update({
      where: { id: pipeline.id },
      data: {
        stage: "DEPOSIT",
        depositAmount: amountUsd,
        depositPaidAt: now,
        cancellationDeadline: deadline,
        stripePaymentIntentId:
          typeof session.payment_intent === "string"
            ? session.payment_intent
            : session.payment_intent?.id ?? null,
      },
    });

    await prisma.survey.create({
      data: {
        pipelineId: pipeline.id,
        venueId: pipeline.venueId,
        surveyType: "POST_BOOKING",
      },
    });
  }

  return NextResponse.json({ ok: true });
}
