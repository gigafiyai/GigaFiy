import { randomBytes } from "crypto";
import { prisma } from "@gigify/db";
import { slugify } from "@/lib/utils";
import { geocodeTown } from "@/lib/geocode";
import { haversineMiles } from "@/lib/discovery";

// Venue workspaces are reached by a secret link. The token is long and random;
// treat it like a password.
export function newVenueToken(): string {
  return randomBytes(18).toString("base64url");
}

export async function createVenueAccount(input: { name: string; city: string; email: string; contactName?: string | null }) {
  // Best effort: without a location the venue simply sees every act.
  const where = await geocodeTown(input.city);
  return prisma.venueAccount.create({
    data: {
      lat: where?.lat ?? null,
      lng: where?.lng ?? null,
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

// Fill in a workspace's location if it is missing (older accounts, or a lookup
// that failed at sign-up).
export async function ensureVenueLocation(account: { id: string; city: string; lat: number | null; lng: number | null }) {
  if (account.lat != null && account.lng != null) return { lat: account.lat, lng: account.lng };
  const where = await geocodeTown(account.city);
  if (where) await prisma.venueAccount.update({ where: { id: account.id }, data: where });
  return where;
}

type Point = { lat: number; lng: number };

// How far the venue is from the closest place an act has played or is booked
// to play. Null when the act has no located shows. Shows saved without a real
// location (0,0) are ignored.
export function nearestMiles(origin: Point, points: Point[]): number | null {
  let best: number | null = null;
  for (const p of points) {
    if (p.lat === 0 && p.lng === 0) continue;
    const d = haversineMiles(origin, p);
    if (best === null || d < best) best = d;
  }
  return best === null ? null : Math.round(best);
}

// Keep acts that play within reach, nearest first. Acts with no known
// location stay in (at the end) rather than being hidden.
export function withinReach<T extends { nearestMiles: number | null }>(acts: T[], radiusMiles: number | null): T[] {
  const kept = radiusMiles == null ? acts : acts.filter((a) => a.nearestMiles == null || a.nearestMiles <= radiusMiles);
  return [...kept].sort((a, b) => (a.nearestMiles ?? Infinity) - (b.nearestMiles ?? Infinity));
}

export type AvailableAct = {
  id: string; name: string; slug: string; genre: string; hometown: string | null;
  hourlyRate: number | null; photoUrl: string | null; soundsLike: string | null; showsPlayed: number;
  nearestMiles: number | null; // closest they've played to this venue; null if unknown
};

// Acts with nothing on their calendar that day: no confirmed show and no
// all-day block.
export async function actsFreeOn(day: Date, startOfToday: Date, origin: Point | null = null): Promise<AvailableAct[]> {
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
      // Where they play: everything from the last year onward.
      shows: {
        where: { status: { in: ["CONFIRMED", "COMPLETED"] }, date: { gte: new Date(startOfToday.getTime() - 365 * 86_400_000) } },
        select: { lat: true, lng: true },
      },
    },
  });
  return artists.map((a) => ({
    nearestMiles: origin ? nearestMiles(origin, a.shows) : null,
    id: a.id, name: a.name, slug: slugify(a.name), genre: a.genre, hometown: a.hometown,
    hourlyRate: a.hourlyRate, photoUrl: a.photoUrl, soundsLike: a.soundsLike, showsPlayed: a._count.shows,
  }));
}
