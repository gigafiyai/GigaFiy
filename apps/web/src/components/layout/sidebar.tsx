"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { AuthStatus } from "@/components/layout/auth-status";
import {
  LayoutDashboard,
  GitBranch,
  Mail,
  Phone,
  CreditCard,
  Calendar,
  ClipboardList,
  Lightbulb,
  Rocket,
  Map as MapIcon,
  PhoneCall,
  Sparkles,
  Settings,
  Menu,
  X,
  ChevronDown,
  type LucideIcon,
} from "lucide-react";

type NavItem = { href: string; icon: LucideIcon; label: string };

// Organized by what the artist is doing, most-used first.
const DAILY: NavItem[] = [
  { href: "/today", icon: Sparkles, label: "Today" },
  { href: "/worklist", icon: PhoneCall, label: "Worklist" },
  { href: "/schedule", icon: Calendar, label: "Schedule" },
];
const BOOKINGS: NavItem[] = [
  { href: "/pipeline", icon: GitBranch, label: "Pipeline" },
  { href: "/outreach", icon: Mail, label: "Inbox" },
  { href: "/payment", icon: CreditCard, label: "Payments" },
];
const MORE: NavItem[] = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/map", icon: MapIcon, label: "Tour Map" },
  { href: "/insights", icon: Lightbulb, label: "Insights" },
  { href: "/surveys", icon: ClipboardList, label: "Surveys" },
  { href: "/campaigns", icon: Rocket, label: "Campaigns" },
  { href: "/voice", icon: Phone, label: "Voice agent" },
];

export function Sidebar() {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const inMore = MORE.some((i) => i.href === pathname);
  const [moreOpen, setMoreOpen] = useState(inMore);

  // Close the phone drawer after navigating.
  useEffect(() => { setDrawerOpen(false); }, [pathname]);
  useEffect(() => { if (inMore) setMoreOpen(true); }, [inMore]);

  const link = ({ href, icon: Icon, label }: NavItem) => {
    const active = pathname === href;
    return (
      <Link
        key={href}
        href={href}
        className={cn(
          "flex items-center gap-2.5 px-2.5 py-2 md:py-1.5 rounded text-sm transition-colors duration-100",
          active
            ? "bg-background text-text font-medium shadow-sm border border-border"
            : "text-text-medium hover:bg-surface-hover hover:text-text"
        )}
      >
        <Icon size={15} strokeWidth={active ? 2 : 1.5} />
        {label}
      </Link>
    );
  };

  const heading = (text: string) => (
    <p className="px-2.5 pt-4 pb-1 text-[10px] uppercase tracking-wide text-text-light">{text}</p>
  );

  const logo = (
    <div className="flex items-center gap-2">
      <div className="w-6 h-6 rounded-md bg-gradient-to-br from-accent-blue to-purple flex items-center justify-center shadow-sm">
        <span className="text-white text-xs font-bold font-display">G</span>
      </div>
      <span className="font-display font-semibold text-text text-base tracking-tight">Gigify</span>
    </div>
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
          "w-64 md:w-56 shrink-0 border-r border-border bg-surface h-screen flex flex-col",
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

        <nav className="flex-1 px-2 pb-3 overflow-y-auto">
          {heading("Daily")}
          <div className="space-y-0.5">{DAILY.map(link)}</div>

          {heading("Bookings")}
          <div className="space-y-0.5">{BOOKINGS.map(link)}</div>

          <button
            type="button"
            onClick={() => setMoreOpen((o) => !o)}
            className="w-full flex items-center justify-between px-2.5 pt-4 pb-1 text-[10px] uppercase tracking-wide text-text-light hover:text-text"
          >
            More
            <ChevronDown size={12} className={cn("transition-transform", moreOpen ? "" : "-rotate-90")} />
          </button>
          {moreOpen && <div className="space-y-0.5">{MORE.map(link)}</div>}
        </nav>

        <div className="px-2 py-3 border-t border-border">
          <AuthStatus />
          <ThemeToggle />
          {link({ href: "/settings", icon: Settings, label: "Settings" })}

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
