// Tenant resolution — the single chokepoint that turns "the artist" from a
// hardcoded findFirst into "the signed-in user's active artist". Every route
// should resolve its artist through here instead of prisma.artist.findFirst.
//
// Behavior:
//   - Auth configured + signed in → that user's artist (via Membership).
//   - Auth configured + no session → null (caller returns 401).
//   - Auth NOT configured (single-tenant pilot) → the first artist (legacy).

import { auth, authConfigured } from "@/lib/auth";
import { prisma } from "@gigify/db";
import type { Artist } from "@gigify/db";

export async function getAuthedArtist(): Promise<Artist | null> {
  if (authConfigured) {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) return null;
    const membership = await prisma.membership.findFirst({
      where: { userId },
      orderBy: { createdAt: "asc" },
      include: { artist: true },
    });
    return membership?.artist ?? null;
  }
  // Single-tenant pilot fallback — keeps everything working until auth is on.
  return prisma.artist.findFirst({ orderBy: { createdAt: "asc" } });
}

export async function getAuthedArtistId(): Promise<string | null> {
  return (await getAuthedArtist())?.id ?? null;
}
