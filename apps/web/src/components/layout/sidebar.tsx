"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
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
  Settings,
} from "lucide-react";

const navItems = [
  { href: "/", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/campaigns", icon: Rocket, label: "Campaigns" },
  { href: "/schedule", icon: Calendar, label: "Schedule" },
  { href: "/pipeline", icon: GitBranch, label: "Pipeline" },
  { href: "/outreach", icon: Mail, label: "Outreach" },
  { href: "/voice", icon: Phone, label: "Voice" },
  { href: "/payment", icon: CreditCard, label: "Payment" },
  { href: "/surveys", icon: ClipboardList, label: "Surveys" },
  { href: "/insights", icon: Lightbulb, label: "Insights" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-56 shrink-0 border-r border-border bg-surface h-screen sticky top-0 flex flex-col">
      <div className="px-4 py-4 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-accent-blue flex items-center justify-center">
            <span className="text-white text-xs font-semibold">G</span>
          </div>
          <span className="font-semibold text-text text-sm tracking-tight">Gigify</span>
        </div>
      </div>

      <nav className="flex-1 px-2 py-3 overflow-y-auto">
        <div className="space-y-0.5">
          {navItems.map(({ href, icon: Icon, label }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-2.5 px-2.5 py-1.5 rounded text-sm transition-colors duration-100",
                  active
                    ? "bg-background text-text font-medium shadow-sm border border-border"
                    : "text-text-medium hover:bg-surface-hover hover:text-text"
                )}
              >
                <Icon size={15} strokeWidth={active ? 2 : 1.5} />
                {label}
              </Link>
            );
          })}
        </div>
      </nav>

      <div className="px-2 py-3 border-t border-border">
        <Link
          href="/settings"
          className={cn(
            "flex items-center gap-2.5 px-2.5 py-1.5 rounded text-sm transition-colors duration-100",
            pathname === "/settings"
              ? "bg-background text-text font-medium shadow-sm border border-border"
              : "text-text-medium hover:bg-surface-hover hover:text-text"
          )}
        >
          <Settings size={15} strokeWidth={pathname === "/settings" ? 2 : 1.5} />
          Settings
        </Link>

        <div className="mt-3 px-2.5">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-accent-blue-bg border border-accent-blue/20 flex items-center justify-center">
              <span className="text-accent-blue text-xs font-medium">E</span>
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-text truncate">Elijah Stone</p>
              <p className="text-xs text-text-light truncate">Indie Folk</p>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
