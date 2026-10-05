import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@gigify/db";

export const dynamic = "force-dynamic";

// Public: serves an artist's uploaded profile photo. URLs carry a version
// suffix that changes on every upload, so the response can be cached hard.
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const photo = await prisma.artistPhoto.findUnique({ where: { artistId: params.id } });
  if (!photo) return new NextResponse(null, { status: 404 });
  return new NextResponse(new Uint8Array(photo.data), {
    headers: {
      "Content-Type": photo.mime,
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
