import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@gigify/db";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { revenue, fee } = (await req.json()) as { revenue?: number | null; fee?: number | null };
  const show = await prisma.show.update({
    where: { id: params.id },
    data: {
      ...(revenue !== undefined ? { revenue } : {}),
      ...(fee !== undefined ? { fee } : {}),
    },
  });
  return NextResponse.json({ id: show.id, revenue: show.revenue, fee: show.fee });
}
