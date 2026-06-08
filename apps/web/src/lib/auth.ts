// Auth.js (NextAuth v5) — Google sign-in + Prisma adapter (database sessions).
// Inert until AUTH_GOOGLE_ID/SECRET are set: with no providers configured,
// `auth()` simply returns null sessions and the single-tenant fallback in
// lib/tenant.ts keeps the app working. Flip on by adding the env vars.

import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@gigify/db";

export const authConfigured = !!(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "database" },
  trustHost: true,
  providers: authConfigured
    ? [Google({ clientId: process.env.AUTH_GOOGLE_ID, clientSecret: process.env.AUTH_GOOGLE_SECRET })]
    : [],
  pages: { signIn: "/login" },
  callbacks: {
    session({ session, user }) {
      if (session.user) session.user.id = user.id;
      return session;
    },
  },
  events: {
    // First sign-in with no membership: if exactly one artist exists and it has
    // no owner yet, adopt it (so the pilot artist is claimed). Otherwise a fresh
    // account starts empty and goes through onboarding.
    async signIn({ user }) {
      if (!user.id) return;
      const existing = await prisma.membership.count({ where: { userId: user.id } });
      if (existing > 0) return;
      const ownerlessSolo = await prisma.artist.findMany({
        where: { memberships: { none: {} } },
        select: { id: true },
        take: 2,
      });
      if (ownerlessSolo.length === 1) {
        await prisma.membership.create({ data: { userId: user.id, artistId: ownerlessSolo[0].id, role: "owner" } });
      }
    },
  },
});
