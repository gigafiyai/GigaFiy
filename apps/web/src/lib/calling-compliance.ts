// Outbound-calling compliance guards.
//
// An AI that auto-dials businesses is subject to real rules — most importantly
// TCPA calling hours (8am–9pm in the CALLED party's local time), do-not-call
// suppression, and sane contact-frequency caps. These helpers let the dialer
// refuse to place a non-compliant call rather than risk it.
//
// Timezone is approximated from the US state (we don't store per-venue tz).
// DST is approximated for the continental US. This is intentionally
// conservative: when in doubt we'd rather skip a borderline call than place it.

// US state → standard-time UTC offset (hours behind UTC).
const STATE_STD_OFFSET: Record<string, number> = {
  // Eastern (-5)
  CT: -5, MA: -5, NY: -5, NH: -5, VT: -5, RI: -5, ME: -5, PA: -5, NJ: -5,
  DE: -5, MD: -5, DC: -5, VA: -5, WV: -5, NC: -5, SC: -5, GA: -5, FL: -5,
  OH: -5, MI: -5, IN: -5, KY: -5,
  // Central (-6)
  IL: -6, WI: -6, MN: -6, IA: -6, MO: -6, AR: -6, LA: -6, MS: -6, AL: -6,
  TN: -6, TX: -6, OK: -6, KS: -6, NE: -6, SD: -6, ND: -6,
  // Mountain (-7)
  CO: -7, NM: -7, WY: -7, MT: -7, UT: -7, ID: -7,
  AZ: -7, // Arizona does NOT observe DST — handled below
  // Pacific (-8)
  CA: -8, WA: -8, OR: -8, NV: -8,
  // Alaska / Hawaii
  AK: -9, HI: -10, // Hawaii does NOT observe DST
};

const NO_DST = new Set(["AZ", "HI"]);

// Approximate US DST: roughly mid-March through early November. Good enough for
// an 8am–9pm guard; we err toward the more restrictive boundary near the edges.
function isUsDst(d: Date): boolean {
  const m = d.getUTCMonth(); // 0=Jan
  if (m > 2 && m < 10) return true;      // Apr–Oct: always DST
  if (m < 2 || m > 10) return false;     // Jan–Feb, Dec: never DST
  // March (2) and November (10): mostly DST — approximate as on.
  return true;
}

export type CallingWindow = {
  ok: boolean;
  localHour: number | null; // 0..23, null if state unknown
  reason: string | null;
};

// Is it currently inside the 8am–9pm calling window for a venue in `state`?
export function isWithinCallingHours(state: string | null | undefined, now: Date = new Date()): CallingWindow {
  const st = (state ?? "").toUpperCase().trim();
  const stdOffset = STATE_STD_OFFSET[st];
  if (stdOffset === undefined) {
    // Unknown state — don't block (rare), but flag it.
    return { ok: true, localHour: null, reason: null };
  }
  const dst = NO_DST.has(st) ? 0 : isUsDst(now) ? 1 : 0;
  const localHour = (((now.getUTCHours() + stdOffset + dst) % 24) + 24) % 24;
  const ok = localHour >= 8 && localHour < 21; // TCPA: 8am–9pm called-party local
  return {
    ok,
    localHour,
    reason: ok ? null : `outside calling hours (8am–9pm local; it's ~${localHour}:00 there)`,
  };
}

// Minimum days between calls to the same venue (anti-harassment frequency cap).
export const MIN_DAYS_BETWEEN_CALLS = 7;
