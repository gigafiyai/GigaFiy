import { prisma } from "@gigify/db";

export const dynamic = "force-dynamic";

// Public unsubscribe page. CAN-SPAM requires a working opt-out that processes
// within 10 business days and needs no login. We process immediately.
export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: { v?: string };
}) {
  const venueId = searchParams.v;
  let done = false;
  let venueName = "";

  if (venueId) {
    const venue = await prisma.venue.findUnique({ where: { id: venueId } });
    if (venue) {
      venueName = venue.name;
      await prisma.venue.update({
        where: { id: venueId },
        data: { optedOut: true },
      });
      // Mark outreach opted out so it reflects in the CRM.
      await prisma.outreach.updateMany({
        where: { venueId, channel: "EMAIL" },
        data: { status: "OPTED_OUT" },
      });
      done = true;
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface px-5">
      <div className="max-w-md w-full bg-background border border-border rounded-lg p-6 text-center">
        {done ? (
          <>
            <div className="w-12 h-12 rounded-full bg-success-green-bg flex items-center justify-center mx-auto mb-3">
              <span className="text-success-green text-xl">✓</span>
            </div>
            <h1 className="text-lg font-semibold text-text">You're unsubscribed</h1>
            <p className="text-sm text-text-medium mt-2">
              {venueName ? `${venueName} has` : "You have"} been removed from this artist's
              outreach list. You won't receive any more booking emails.
            </p>
          </>
        ) : (
          <>
            <h1 className="text-lg font-semibold text-text">Unsubscribe</h1>
            <p className="text-sm text-text-medium mt-2">
              We couldn't find that subscription. It may have already been removed.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
