import { notFound, redirect } from "next/navigation";
import { prisma } from "@gigify/db";
import { getStripe, depositAmountCents } from "@/lib/stripe";
import { StubCheckout } from "./stub-checkout";

export const dynamic = "force-dynamic";

export default async function CheckoutPage({
  params,
}: {
  params: { pipelineId: string };
}) {
  const pipeline = await prisma.pipeline.findUnique({
    where: { id: params.pipelineId },
    include: { venue: true, artist: true },
  });
  if (!pipeline) notFound();

  // Already paid? Skip straight to Survey 1 / success.
  if (pipeline.stage === "DEPOSIT" || pipeline.stage === "BOOKED") {
    redirect(`/checkout/${pipeline.id}/success`);
  }

  const stripe = getStripe();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3001";
  const amountCents = depositAmountCents(pipeline);

  // Real Stripe Checkout — create a session and redirect.
  if (stripe) {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            unit_amount: amountCents,
            product_data: {
              name: `${pipeline.artist.name} — deposit (50%)`,
              description: `${pipeline.venue.name} · holds your date · 24h free cancellation after payment.`,
            },
          },
          quantity: 1,
        },
      ],
      success_url: `${appUrl}/checkout/${pipeline.id}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/checkout/${pipeline.id}`,
      customer_email: pipeline.venue.decisionMakerEmail ?? pipeline.venue.email ?? undefined,
      metadata: { pipelineId: pipeline.id },
      payment_intent_data: { metadata: { pipelineId: pipeline.id } },
    });

    if (!session.url) throw new Error("Stripe session missing URL");
    redirect(session.url);
  }

  // Stub mode: render a fake-Stripe page with a Simulate button.
  return (
    <StubCheckout
      pipelineId={pipeline.id}
      artistName={pipeline.artist.name}
      venueName={pipeline.venue.name}
      amountCents={amountCents}
    />
  );
}
