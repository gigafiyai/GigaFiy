import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@gigify/db";
import { runEnrichment, type EnrichmentTier } from "@/lib/enrichment";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const tier = (req.nextUrl.searchParams.get("tier") ?? "free") as EnrichmentTier;
  const venue = await prisma.venue.findUnique({ where: { id: params.id } });
  if (!venue) return NextResponse.json({ error: "venue not found" }, { status: 404 });

  const result = await runEnrichment(
    {
      venueName: venue.name,
      city: venue.city,
      state: venue.state,
      venueType: venue.venueType,
      website: venue.website,
    },
    tier
  );

  if (result.source === "none") {
    return NextResponse.json({
      ok: true,
      enriched: false,
      tier: result.tier,
      reason: result.notes ?? "no contact found",
    });
  }

  // Only fill blanks — never overwrite existing values.
  const f = result.fieldsAvailable;
  const updates: Record<string, string> = {};
  if (f.name && !venue.decisionMakerName) updates.decisionMakerName = f.name;
  if (f.email && !venue.decisionMakerEmail) updates.decisionMakerEmail = f.email;
  if (f.email && !venue.email) updates.email = f.email;
  if (f.phone && !venue.decisionMakerPhone) updates.decisionMakerPhone = f.phone;
  if (f.title) {
    const existing = venue.decisionMakerRole?.toLowerCase() ?? "";
    if (!existing.includes(f.title.toLowerCase())) {
      updates.decisionMakerRole = f.title;
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({
      ok: true,
      enriched: false,
      tier: result.tier,
      source: result.source,
      reason: "venue already populated",
    });
  }

  const updated = await prisma.venue.update({
    where: { id: venue.id },
    data: updates as Parameters<typeof prisma.venue.update>[0]["data"],
  });

  return NextResponse.json({
    ok: true,
    enriched: true,
    tier: result.tier,
    source: result.source,
    fieldsUpdated: Object.keys(updates),
    venue: {
      id: updated.id,
      decisionMakerName: updated.decisionMakerName,
      decisionMakerRole: updated.decisionMakerRole,
      decisionMakerEmail: updated.decisionMakerEmail,
      decisionMakerPhone: updated.decisionMakerPhone,
    },
  });
}
