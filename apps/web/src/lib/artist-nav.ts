// The artist app's navigation: a few sections, each a job the artist does.
// Related pages live under one section as tabs rather than as separate menu
// items. The sidebar and the tab bar both read from this list.

export type NavPage = { href: string; label: string };
export type NavSection = { id: string; label: string; pages: NavPage[] };

export const ARTIST_SECTIONS: NavSection[] = [
  { id: "today", label: "Today", pages: [{ href: "/today", label: "Today" }] },
  {
    id: "venues",
    label: "Venues",
    pages: [
      { href: "/worklist", label: "To contact" },
      { href: "/pipeline", label: "All venues" },
      { href: "/outreach", label: "Replies" },
      { href: "/dashboard", label: "Find more" },
    ],
  },
  {
    id: "schedule",
    label: "Schedule",
    pages: [
      { href: "/schedule", label: "Calendar" },
      { href: "/map", label: "Tour map" },
    ],
  },
  {
    id: "bookings",
    label: "Bookings",
    pages: [
      { href: "/payment", label: "Payments" },
      { href: "/surveys", label: "Venue feedback" },
      { href: "/insights", label: "Insights" },
    ],
  },
];

// Profile plus the automation tools, which most artists won't need day to day.
export const SETTINGS_SECTION: NavSection = {
  id: "settings",
  label: "Settings",
  pages: [
    { href: "/settings", label: "Profile" },
    { href: "/campaigns", label: "Bulk outreach" },
    { href: "/voice", label: "Voice agent" },
  ],
};

export function sectionFor(pathname: string): NavSection | null {
  return [...ARTIST_SECTIONS, SETTINGS_SECTION].find((s) => s.pages.some((p) => p.href === pathname)) ?? null;
}
