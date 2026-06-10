import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@gigify/db";
import { getAuthedArtist } from "@/lib/tenant";
import { getStripe } from "@/lib/stripe";
import { GEM_PACKS } from "@/lib/gems";
import { apiHandler } from "@/lib/api-handler";

export const dynamic = "force-dynamic";

const schema = z.object({ packIndex: z.number().int().min(0) });

// Start a Stripe Checkout to buy a gem pack. On payment, the Stripe webhook
// credits the gems. Inline price_data — no pre-created Stripe products needed.
export const POST = apiHandler({
  schema,
  handler: async ({ packIndex }) => {
    const stripe = getStripe();
    if (!stripe) {
      return NextResponse.json({ error: "Stripe not configured — set STRIPE_SECRET_KEY", configured: false }, { status: 503 });
    }
    const pack = GEM_PACKS[packIndex];
    if (!pack) return NextResponse.json({ error: "invalid packIndex", packs: GEM_PACKS }, { status: 400 });

    const artist = await getAuthedArtist();
    if (!artist) return NextResponse.json({ error: "no artist" }, { status: 404 });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: Math.round(pack.usd * 100),
            product_data: { name: `${pack.gems.toLocaleString()} Gigify gems`, description: `${pack.label} pack` },
          },
        },
      ],
      metadata: { kind: "gems", artistId: artist.id, gems: String(pack.gems), pack: pack.label },
      success_url: `${appUrl}/?gems=success`,
      cancel_url: `${appUrl}/?gems=cancelled`,
    });

    return { ok: true, url: session.url, gems: pack.gems, usd: pack.usd };
  },
});
