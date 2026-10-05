import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@gigify/db";
import { findOrCreateSignup } from "@/lib/signups";

export const dynamic = "force-dynamic";

const Body = z.object({
  email: z.string().trim().toLowerCase().email().max(200),
  ref: z.string().trim().max(32).optional(),
});

// A fan says "I'm going" to a public, upcoming gig. Idempotent per email.
// Returns the new headcount and the fan's share code.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });

  const show = await prisma.show.findUnique({ where: { id: params.id }, select: { id: true, status: true, date: true, showType: true, city: true, state: true } });
  if (!show || show.showType === "private") return NextResponse.json({ error: "Gig not found." }, { status: 404 });

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  if (show.status !== "CONFIRMED" || show.date < startOfToday) {
    return NextResponse.json({ error: "This gig is no longer open." }, { status: 409 });
  }

  const { signup } = await findOrCreateSignup({ email: parsed.data.email, role: "fan", city: `${show.city}, ${show.state}`, ref: parsed.data.ref });
  await prisma.gigInterest.upsert({
    where: { showId_signupId: { showId: show.id, signupId: signup.id } },
    create: { showId: show.id, signupId: signup.id },
    update: {},
  });
  const going = await prisma.gigInterest.count({ where: { showId: show.id } });
  return NextResponse.json({ ok: true, going, refCode: signup.refCode });
}
