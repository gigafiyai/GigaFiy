import { randomBytes } from "crypto";
import { prisma } from "@gigify/db";

export type SignupRole = "fan" | "venue" | "artist";

// One sign-up per email + role. Returns the existing row if there is one, so a
// person always keeps the same share code. `ref` is the share code of whoever
// sent them; it is only recorded the first time.
export async function findOrCreateSignup(input: { email: string; role: SignupRole; city?: string | null; ref?: string | null }) {
  const email = input.email.trim().toLowerCase();
  const existing = await prisma.signup.findUnique({ where: { email_role: { email, role: input.role } } });
  if (existing) return { signup: existing, created: false };

  const referrer = input.ref ? await prisma.signup.findUnique({ where: { refCode: input.ref }, select: { id: true } }) : null;
  const signup = await prisma.signup.create({
    data: {
      email,
      role: input.role,
      city: input.city?.trim() || null,
      refCode: randomBytes(5).toString("hex"),
      referredById: referrer?.id ?? null,
    },
  });
  return { signup, created: true };
}
