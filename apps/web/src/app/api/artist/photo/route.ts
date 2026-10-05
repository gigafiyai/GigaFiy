import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@gigify/db";
import { getAuthedArtist } from "@/lib/tenant";

export const dynamic = "force-dynamic";

const MAX_BYTES = 600 * 1024; // the client resizes to ~512px first, so this is generous

// Identify the image from its leading bytes rather than trusting the upload's
// declared type.
function sniff(buf: Buffer): string | null {
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buf.length > 12 && buf.subarray(0, 4).toString("ascii") === "RIFF" && buf.subarray(8, 12).toString("ascii") === "WEBP") return "image/webp";
  return null;
}

// POST (multipart, field "photo") → store the signed-in artist's profile photo.
export async function POST(req: NextRequest) {
  const artist = await getAuthedArtist();
  if (!artist) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const form = await req.formData().catch(() => null);
  const file = form?.get("photo");
  if (!(file instanceof Blob)) return NextResponse.json({ error: "No photo received." }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "That photo is too large. Try a smaller one." }, { status: 413 });

  const data = Buffer.from(await file.arrayBuffer());
  const mime = sniff(data);
  if (!mime) return NextResponse.json({ error: "Use a JPEG, PNG or WebP image." }, { status: 415 });

  await prisma.artistPhoto.upsert({
    where: { artistId: artist.id },
    create: { artistId: artist.id, data, mime },
    update: { data, mime },
  });
  // The version suffix makes browsers fetch the new photo instead of a cached one.
  const photoUrl = `/api/artists/${artist.id}/photo?v=${Date.now()}`;
  await prisma.artist.update({ where: { id: artist.id }, data: { photoUrl } });
  return NextResponse.json({ ok: true, photoUrl });
}

// DELETE → remove the photo.
export async function DELETE() {
  const artist = await getAuthedArtist();
  if (!artist) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  await prisma.artistPhoto.deleteMany({ where: { artistId: artist.id } });
  await prisma.artist.update({ where: { id: artist.id }, data: { photoUrl: null } });
  return NextResponse.json({ ok: true });
}
