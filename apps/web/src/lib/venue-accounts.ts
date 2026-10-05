import { randomBytes } from "crypto";
import { prisma } from "@gigify/db";
import { slugify } from "@/lib/utils";

// Venue workspaces are reached by a secret link. The token is long and random;
// treat it like a password.
export function newVenueToken(): string {
  return randomBytes(18).toString("base64url");
}

export async function createVenueAccount(input: { name: string; city: string; email: string; contactName?: string | null }) {
  return prisma.venueAccount.create({
    data: {
      name: input.name.trim(),
      city: input.city.trim(),
      email: input.email.trim().toLowerCase(),
      contactName: input.contactName?.trim() || null,
      accessToken: newVenueToken(),
    },
  });
}

export function venueAccountByToken(token: string) {
  return prisma.venueAccount.findUnique({ where: { accessToken: token } });
}

// Parse a YYYY-MM-DD string into the stored-date form (midnight UTC), or null.
export function parseDay(iso: string | null | undefined): Date | null {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const d = new Date(`${iso}T00:00:00.000Z`);
  return isNaN(d.getTime()) ? null : d;
}

export type AvailableAct = {
  id: string; name: string; slug: string; genre: string; hometown: string | null;
  hourlyRate: number | null; photoUrl: string | null; soundsLike: string | null; showsPlayed: number;
};

// Acts with nothing on their calendar that day: no confirmed show and no
// all-day block.
export async function actsFreeOn(day: Date, startOfToday: Date): Promise<AvailableAct[]> {
  const next = new Date(day.getTime() + 86_400_000);
  const artists = await prisma.artist.findMany({
    where: {
      shows: { none: { status: "CONFIRMED", date: { gte: day, lt: next } } },
      availability: { none: { allDay: true, date: { gte: day, lt: next } } },
    },
    orderBy: { createdAt: "asc" },
    take: 50,
    select: {
      id: true, name: true, genre: true, hometown: true, hourlyRate: true, photoUrl: true, soundsLike: true,
      _count: { select: { shows: { where: { status: { in: ["CONFIRMED", "COMPLETED"] }, date: { lt: startOfToday } } } } },
    },
  });
  return artists.map((a) => ({
    id: a.id, name: a.name, slug: slugify(a.name), genre: a.genre, hometown: a.hometown,
    hourlyRate: a.hourlyRate, photoUrl: a.photoUrl, soundsLike: a.soundsLike, showsPlayed: a._count.shows,
  }));
}
