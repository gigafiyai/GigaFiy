// Generated email bodies that don't need Claude — confirmation, reminders, etc.

export type ConfirmationContext = {
  artistName: string;
  artistContactEmail: string;
  venueName: string;
  contactFirstName: string | null;
  bookedShowDate: Date | null;
  bookedShowFee: number | null;
  depositAmount: number | null;
  cancellationDeadline: Date | null;
};

function formatDeadline(d: Date | null): string {
  if (!d) return "tomorrow at 11:59 PM";
  return d.toLocaleString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatShowDate(d: Date | null): string | null {
  if (!d) return null;
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function buildConfirmationEmail(ctx: ConfirmationContext): {
  subject: string;
  text: string;
} {
  const greeting = ctx.contactFirstName ? `Hi ${ctx.contactFirstName},` : "Hi,";
  const showDate = formatShowDate(ctx.bookedShowDate);
  const deadline = formatDeadline(ctx.cancellationDeadline);

  const lines: string[] = [];
  lines.push(greeting);
  lines.push("");
  lines.push(
    `Your deposit for ${ctx.artistName} at ${ctx.venueName} is confirmed${showDate ? ` for ${showDate}` : ""}.`
  );
  lines.push("");
  lines.push(`Your free cancellation window closes at ${deadline}.`);
  lines.push("Reply to this email to cancel — full refund, no questions asked.");
  lines.push("");
  if (ctx.depositAmount != null) {
    lines.push(`Deposit received: $${ctx.depositAmount.toLocaleString()}`);
  }
  if (ctx.bookedShowFee != null) {
    lines.push(`Total fee: $${ctx.bookedShowFee.toLocaleString()} (balance due day-of)`);
  }
  lines.push("");
  lines.push(
    `Contract + calendar invite are on their way separately. I'll also check in 1 week and 48 hours before the show to confirm load-in.`
  );
  lines.push("");
  lines.push(`Thanks for the booking.`);
  lines.push(`— ${ctx.artistName}`);

  const subject = showDate
    ? `Booking confirmed — ${ctx.artistName} at ${ctx.venueName}, ${showDate}`
    : `Booking confirmed — ${ctx.artistName} at ${ctx.venueName}`;

  return { subject, text: lines.join("\n") };
}
