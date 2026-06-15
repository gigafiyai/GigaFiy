import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@gigify/db";
import { getAuthedArtist } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export async function GET() {
  const artist = await getAuthedArtist();
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
  "mailingAddress",
  "voicemailScript",
  "spotifyUrl",
  "videoReelUrl",
  "epkUrl",
  "contactName",
  "contactEmail",
  "contactPhone",
  // Tulio agent-brief depth — what makes him sound versed
  "soundsLike",
  "audienceProfile",
  "performanceStyle",
  "accolades",
  "bookingAgentName",
] as const;

type EditableField = (typeof EDITABLE_FIELDS)[number];

export async function PATCH(req: NextRequest) {
  const artist = await getAuthedArtist();
  if (!artist) return NextResponse.json({ error: "no artist" }, { status: 404 });

  const body = (await req.json()) as Record<string, unknown>;
  const data: Record<string, unknown> = {};
  for (const k of EDITABLE_FIELDS) {
    if (k in body) {
      const v = body[k];
      if (v === null || typeof v === "string") {
        data[k] = v;
      }
    }
  }

  // Numeric: standard hourly rate.
  if ("hourlyRate" in body) {
    const v = body.hourlyRate;
    if (v === null || v === "") data.hourlyRate = null;
    else if (typeof v === "number") data.hourlyRate = v;
    else if (typeof v === "string" && !isNaN(Number(v))) data.hourlyRate = Number(v);
  }

  // Required fields (name, genre, bio, etc.) shouldn't be null; UI prevents it.
  const updated = await prisma.artist.update({
    where: { id: artist.id },
    data: data as Parameters<typeof prisma.artist.update>[0]["data"],
  });
  return NextResponse.json(updated);
}
