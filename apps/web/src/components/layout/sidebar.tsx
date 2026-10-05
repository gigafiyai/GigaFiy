"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { AuthStatus } from "@/components/layout/auth-status";
import { ARTIST_SECTIONS, SETTINGS_SECTION, type NavSection } from "@/lib/artist-nav";
import { Sparkles, Store, Calendar, CreditCard, Settings, Menu, X, Home, Building2, type LucideIcon } from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  today: Sparkles,
  venues: Store,
  schedule: Calendar,
  bookings: CreditCard,
  settings: Settings,
};

export function Sidebar() {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Close the phone drawer after navigating.
  useEffect(() => { setDrawerOpen(false); }, [pathname]);

  const link = (section: NavSection) => {
    const Icon = ICONS[section.id] ?? Sparkles;
    const active = section.pages.some((p) => p.href === pathname);
    return (
      <Link
        key={section.id}
        href={section.pages[0].href}
        className={cn(
          "flex items-center gap-2.5 px-2.5 py-2 rounded text-sm transition-colors duration-100",
          active
            ? "bg-background text-text font-medium shadow-sm border border-border"
            : "text-text-medium hover:bg-surface-hover hover:text-text"
        )}
      >
        <Icon size={16} strokeWidth={active ? 2 : 1.5} />
        {section.label}
      </Link>
    );
  };

  const logo = (
    <Link href="/" className="flex items-center gap-2" title="Gigify home">
      <div className="w-6 h-6 rounded-md bg-gradient-to-br from-accent-blue to-purple flex items-center justify-center shadow-sm">
        <span className="text-white text-xs font-bold font-display">G</span>
      </div>
      <span className="font-display font-semibold text-text text-base tracking-tight">Gigify</span>
    </Link>
  );

  return (
    <>
      {/* Phone top bar */}
      <div className="md:hidden flex items-center justify-between px-4 py-3 border-b border-border bg-surface shrink-0">
        {logo}
        <button type="button" aria-label="Open menu" onClick={() => setDrawerOpen(true)} className="text-text-medium p-1">
          <Menu size={20} />
        </button>
      </div>

      {drawerOpen && <div className="md:hidden fixed inset-0 z-30 bg-black/50" onClick={() => setDrawerOpen(false)} />}

      <aside
        className={cn(
          "w-64 md:w-52 shrink-0 border-r border-border bg-surface h-screen flex flex-col",
          "fixed inset-y-0 left-0 z-40 transition-transform duration-200 md:sticky md:top-0 md:translate-x-0",
          drawerOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="px-4 py-4 border-b border-border flex items-center justify-between">
          {logo}
          <button type="button" aria-label="Close menu" onClick={() => setDrawerOpen(false)} className="md:hidden text-text-medium p-1">
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 px-2 py-3 overflow-y-auto">
          <div className="space-y-0.5">{ARTIST_SECTIONS.map(link)}</div>

          {/* The way out of the artist app, to the other two sides of Gigify. */}
          <p className="px-2.5 pt-5 pb-1 text-[10px] uppercase tracking-wide text-text-light">Elsewhere on Gigify</p>
          <div className="space-y-0.5">
            <Link href="/" className="flex items-center gap-2.5 px-2.5 py-2 rounded text-sm text-text-medium hover:bg-surface-hover hover:text-text">
              <Home size={16} strokeWidth={1.5} /> Home &amp; gigs
            </Link>
            <Link href="/venues" className="flex items-center gap-2.5 px-2.5 py-2 rounded text-sm text-text-medium hover:bg-surface-hover hover:text-text">
              <Building2 size={16} strokeWidth={1.5} /> For venues
            </Link>
          </div>
        </nav>

        <div className="px-2 py-3 border-t border-border">
          <AuthStatus />
          <ThemeToggle />
          {link(SETTINGS_SECTION)}

          <div className="mt-3 px-2.5">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-accent-blue-bg border border-accent-blue/20 flex items-center justify-center">
                <span className="text-accent-blue text-xs font-medium">E</span>
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-text truncate">Elijah Stone</p>
                <p className="text-xs text-text-light truncate">Pop · Soul · Rock</p>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
