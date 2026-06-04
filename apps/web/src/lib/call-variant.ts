// Maps a venue decision-maker's role to a coarse contact category, stored on
// the Call row for CRM segmentation. (All scripted-call logic was removed when
// Tulio's dynamic agent brief replaced the old static Nova scripts.)

export type ContactVariant = "owner" | "talent_buyer" | "event_coordinator";

export function variantForRole(role: string | null | undefined): ContactVariant {
  if (!role) return "owner";
  const r = role.toLowerCase();
  if (r.includes("talent")) return "talent_buyer";
  if (r.includes("coordinator") || r.includes("event")) return "event_coordinator";
  return "owner";
}
