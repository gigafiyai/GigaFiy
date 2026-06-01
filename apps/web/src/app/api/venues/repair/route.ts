import { NextResponse } from "next/server";
import { prisma } from "@gigify/db";
import {
  parseCityFromAddress,
  parseStateFromAddress,
  reclassifyByName,
} from "@/lib/discovery";
import { isJunkEmail } from "@/lib/web-scrape";

export const dynamic = "force-dynamic";

// One-shot maintenance: walks every venue, re-parses the city/state from
// its stored address (which Google Places gave us), and reclassifies the
// venue type based on the name (catches "Harvard Art Museums" → ARTS_CENTER
// where Google returned both `museum` and `restaurant` types).
//
// Does NOT call Google Places — free to run.
export async function POST() {
  const venues = await prisma.venue.findMany({
    select: {
      id: true,
      name: true,
      city: true,
      state: true,
      address: true,
      venueType: true,
      decisionMakerRole: true,
      decisionMakerEmail: true,
      email: true,
    },
  });

  let cityFixed = 0;
  let stateFixed = 0;
  let typeFixed = 0;
  let emailsCleared = 0;

  for (const v of venues) {
    const updates: Record<string, string | null> = {};

    // Junk emails (template placeholders like user@domain.com, vendor footers, etc.)
    if (v.decisionMakerEmail && isJunkEmail(v.decisionMakerEmail)) {
      updates.decisionMakerEmail = null;
      emailsCleared++;
    }
    if (v.email && isJunkEmail(v.email)) {
      updates.email = null;
      // Only count once per venue.
      if (!("decisionMakerEmail" in updates)) emailsCleared++;
    }

    const parsedCity = parseCityFromAddress(v.address);
    if (parsedCity && parsedCity !== v.city) {
      updates.city = parsedCity;
      cityFixed++;
    }

    const parsedState = parseStateFromAddress(v.address);
    if (parsedState && parsedState !== v.state) {
      updates.state = parsedState;
      stateFixed++;
    }

    const nextType = reclassifyByName(v.name, v.venueType);
    if (nextType !== v.venueType) {
      updates.venueType = nextType;
      typeFixed++;
      // Update decision maker role to match the new type if it's the default.
      const currentRole = v.decisionMakerRole?.toLowerCase() ?? "";
      if (!currentRole || currentRole === "manager" || currentRole === "owner") {
        if (nextType === "ARTS_CENTER" || nextType === "FARMERS_MARKET" || nextType === "FESTIVAL") {
          updates.decisionMakerRole = "Event Coordinator";
        } else if (nextType === "MUSIC_CLUB") {
          updates.decisionMakerRole = "Talent Buyer";
        } else if (nextType === "BAR") {
          updates.decisionMakerRole = "Owner";
        }
      }
    }

    if (Object.keys(updates).length > 0) {
      await prisma.venue.update({
        where: { id: v.id },
        data: updates as Record<string, string | null>,
      });
    }
  }

  return NextResponse.json({
    ok: true,
    venuesScanned: venues.length,
    cityFixed,
    stateFixed,
    typeFixed,
    emailsCleared,
  });
}
