// Generates a .ics calendar invite string for a confirmed booking.
// Attached to the confirmation email so both artist and venue can
// add the show to their calendars in one click.

export type CalendarEvent = {
  uid: string; // unique per booking — use pipeline ID
  summary: string; // e.g. "Elijah Stone at The Hideout"
  description: string;
  location: string;
  startUtc: Date;
  endUtc: Date;
  organizerName: string;
  organizerEmail: string;
  attendeeEmail: string | null;
};

function icsDate(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function escape(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

export function buildICS(evt: CalendarEvent): string {
  const now = icsDate(new Date());
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Gigify//Booking Agent//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:REQUEST",
    "BEGIN:VEVENT",
    `UID:${evt.uid}@gigify.io`,
    `DTSTAMP:${now}`,
    `DTSTART:${icsDate(evt.startUtc)}`,
    `DTEND:${icsDate(evt.endUtc)}`,
    `SUMMARY:${escape(evt.summary)}`,
    `DESCRIPTION:${escape(evt.description)}`,
    `LOCATION:${escape(evt.location)}`,
    `ORGANIZER;CN="${escape(evt.organizerName)}":mailto:${evt.organizerEmail}`,
  ];

  if (evt.attendeeEmail) {
    lines.push(
      `ATTENDEE;CUTYPE=INDIVIDUAL;ROLE=REQ-PARTICIPANT;PARTSTAT=ACCEPTED;CN="${escape(evt.organizerName)}":mailto:${evt.organizerEmail}`,
      `ATTENDEE;CUTYPE=INDIVIDUAL;ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE:mailto:${evt.attendeeEmail}`
    );
  }

  lines.push(
    "STATUS:CONFIRMED",
    "TRANSP:OPAQUE",
    "END:VEVENT",
    "END:VCALENDAR"
  );

  return lines.join("\r\n");
}

// Builds a default 2-hour show event if we don't have exact times.
export function buildBookingICS(opts: {
  pipelineId: string;
  artistName: string;
  venueName: string;
  venueAddress: string;
  bookedShowDate: Date | null;
  artistEmail: string;
  venueEmail: string | null;
}): string | null {
  if (!opts.bookedShowDate) return null;

  // Default: 8pm–10pm local (stored as UTC — close enough for a calendar placeholder)
  const start = new Date(opts.bookedShowDate);
  start.setUTCHours(20, 0, 0, 0);
  const end = new Date(start.getTime() + 2 * 3600000);

  const description = [
    `${opts.artistName} live at ${opts.venueName}`,
    "",
    "Booking confirmed via Gigify.",
    `50% deposit paid. Balance due day-of.`,
    "",
    `Questions? Reply to this email or contact ${opts.artistEmail}`,
  ].join("\n");

  return buildICS({
    uid: opts.pipelineId,
    summary: `${opts.artistName} @ ${opts.venueName}`,
    description,
    location: opts.venueAddress,
    startUtc: start,
    endUtc: end,
    organizerName: opts.artistName,
    organizerEmail: opts.artistEmail,
    attendeeEmail: opts.venueEmail,
  });
}
