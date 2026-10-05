"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { sectionFor } from "@/lib/artist-nav";

// The tabs across the top of a section with more than one page.
export function SectionTabs() {
  const pathname = usePathname();
  const section = sectionFor(pathname);
  if (!section || section.pages.length < 2) return null;

  return (
    <div className="border-b border-border bg-surface px-4 md:px-6 overflow-x-auto">
      <nav className="flex gap-1" aria-label={section.label}>
        {section.pages.map((p) => {
          const active = p.href === pathname;
          return (
            <Link
              key={p.href}
              href={p.href}
              className={cn(
                "px-3 py-2.5 text-sm whitespace-nowrap border-b-2 -mb-px transition-colors",
                active ? "border-accent-blue text-text font-medium" : "border-transparent text-text-medium hover:text-text"
              )}
            >
              {p.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
