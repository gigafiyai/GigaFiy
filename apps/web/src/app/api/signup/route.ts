import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@gigify/db";
import { findOrCreateSignup } from "@/lib/signups";

export const dynamic = "force-dynamic";

const Body = z.object({
  email: z.string().trim().toLowerCase().email().max(200),
  role: z.enum(["fan", "venue", "artist"]),
  city: z.string().trim().max(120).optional(),
  ref: z.string().trim().max(32).optional(),
});

// Public early-access sign-up for fans, venues and artists. Returns the
// person's share code and how many people have joined through it. Signing up
// again with the same email + role returns the same code.
export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });

  const { signup, created } = await findOrCreateSignup(parsed.data);
  const referrals = created ? 0 : await prisma.signup.count({ where: { referredById: signup.id } });
  return NextResponse.json({ ok: true, refCode: signup.refCode, referrals, returning: !created });
}
