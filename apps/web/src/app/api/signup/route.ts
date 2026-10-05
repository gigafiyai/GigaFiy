import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { z } from "zod";
import { prisma } from "@gigify/db";

export const dynamic = "force-dynamic";

const Body = z.object({
  email: z.string().trim().toLowerCase().email().max(200),
  role: z.enum(["fan", "venue", "artist"]),
  city: z.string().trim().max(120).optional(),
  ref: z.string().trim().max(32).optional(),
});

function newCode() {
  return randomBytes(5).toString("hex");
}

// Public early-access sign-up for fans, venues and artists. Returns the
// person's share code and how many people have joined through it. Signing up
// again with the same email + role returns the same code.
export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  const { email, role, city, ref } = parsed.data;

  const existing = await prisma.signup.findUnique({
    where: { email_role: { email, role } },
    include: { _count: { select: { referrals: true } } },
  });
  if (existing) {
    return NextResponse.json({ ok: true, refCode: existing.refCode, referrals: existing._count.referrals, returning: true });
  }

  const referrer = ref ? await prisma.signup.findUnique({ where: { refCode: ref }, select: { id: true } }) : null;
  const created = await prisma.signup.create({
    data: { email, role, city: city || null, refCode: newCode(), referredById: referrer?.id ?? null },
  });
  return NextResponse.json({ ok: true, refCode: created.refCode, referrals: 0, returning: false });
}
