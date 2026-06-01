import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@gigify/db";

export const dynamic = "force-dynamic";

// Generates a deposit link. Stripe Checkout when configured, stub URL otherwise.
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const pipeline = await prisma.pipeline.findUnique({
    where: { id: params.id },
    include: { venue: true },
  });
  if (!pipeline) return NextResponse.json({ error: "pipeline not found" }, { status: 404 });

  const hasStripe = !!process.env.STRIPE_SECRET_KEY;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3001";
  const fakeLink = `${appUrl}/checkout/${pipeline.id}`;

  // Stripe Checkout creation will live here once a key is set.
  return NextResponse.json({
    ok: true,
    mode: hasStripe ? "stripe" : "stub",
    link: fakeLink,
    venue: pipeline.venue.name,
  });
}
