import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@gigify/db";

export const dynamic = "force-dynamic";

// Single-artist MVP: returns Elijah (or whoever is first).
async function getPilotArtist() {
  return prisma.artist.findFirst({ orderBy: { createdAt: "asc" } });
}

export async function GET() {
  const artist = await getPilotArtist();
  if (!artist) return NextResponse.json({ error: "no artist" }, { status: 404 });
  return NextResponse.json(artist);
}

const EDITABLE_FIELDS = [
  "name",
  "genre",
  "bio",
  "drawDescription",
  "hometown",
  "instagramHandle",
  "voicemailScript",
  "spotifyUrl",
  "videoReelUrl",
  "epkUrl",
  "contactName",
  "contactEmail",
  "contactPhone",
] as const;

type EditableField = (typeof EDITABLE_FIELDS)[number];

export async function PATCH(req: NextRequest) {
  const artist = await getPilotArtist();
  if (!artist) return NextResponse.json({ error: "no artist" }, { status: 404 });

  const body = (await req.json()) as Record<string, unknown>;
  const data: Partial<Record<EditableField, string | null>> = {};
  for (const k of EDITABLE_FIELDS) {
    if (k in body) {
      const v = body[k];
      if (v === null || typeof v === "string") {
        data[k] = v as string | null;
      }
    }
  }

  // Required fields (name, genre, bio, etc.) shouldn't be null; UI prevents it.
  const updated = await prisma.artist.update({
    where: { id: artist.id },
    data: data as Record<string, string | null>,
  });
  return NextResponse.json(updated);
}
