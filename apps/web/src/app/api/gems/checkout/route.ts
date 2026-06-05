import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@gigify/db";
import { getStripe } from "@/lib/stripe";
import { GEM_PACKS } from "@/lib/gems";

export const dynamic = "force-dynamic";

// Start a Stripe Checkout to buy a gem pack. On payment, the Stripe webhook
// credits the gems. Uses inline price_data so no pre-created Stripe products
// are needed.
//   POST { packIndex }  →  { url }   (redirect the buyer to url)
export async function POST(req: NextRequest) {
  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json({ error: "Stripe not configured — set STRIPE_SECRET_KEY", configured: false }, { status: 503 });
  }

  const body = (await req.json().catch(() => ({}))) as { packIndex?: number };
  const pack = GEM_PACKS[body.packIndex ?? -1];
  if (!pack) {
    return NextResponse.json({ error: "invalid packIndex", packs: GEM_PACKS }, { status: 400 });
  }

  const artist = await prisma.artist.findFirst({ orderBy: { createdAt: "asc" } });
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
          product_data: {
            name: `${pack.gems.toLocaleString()} Gigify gems`,
            description: `${pack.label} pack`,
          },
        },
      },
    ],
    metadata: { kind: "gems", artistId: artist.id, gems: String(pack.gems), pack: pack.label },
    success_url: `${appUrl}/?gems=success`,
    cancel_url: `${appUrl}/?gems=cancelled`,
  });

  return NextResponse.json({ ok: true, url: session.url, gems: pack.gems, usd: pack.usd });
}
