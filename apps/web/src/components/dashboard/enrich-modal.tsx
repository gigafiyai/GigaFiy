"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { X, Check, Lock, Zap, Globe, Cpu, Star, Phone, type LucideIcon } from "lucide-react";

export type EnrichTier = "free" | "deep" | "premium";

type Props = {
  artistPlan: "starter" | "pro" | "agency";
  onSelect: (tier: EnrichTier) => void;
  onClose: () => void;
};

type TierDef = {
  id: EnrichTier;
  name: string;
  tagline: string;
  icon: LucideIcon;
  features: string[];
  badge: string | null;
  badgeColor: string;
  requiredPlan: "starter" | "pro" | "agency";
  cost: string;
};

const TIERS: TierDef[] = [
  {
    id: "free",
    name: "Web Scrape",
    tagline: "Fast fetch, regex, schema.org extraction",
    icon: Globe,
    features: [
      "Scrapes /contact and /booking pages",
      "Schema.org structured data (email, phone, social links)",
      "Venue narrative for email personalization",
      "Facebook page signal for hostsLiveMusic",
      "Smart path ordering by venue type",
      "8× parallel — ~60s per show",
    ],
    badge: "Free",
    badgeColor: "bg-success-green-bg text-success-green border-success-green/30",
    requiredPlan: "starter",
    cost: "Included",
  },
  {
    id: "deep",
    name: "Deep Scrape",
    tagline: "Headless browser — finds JS-rendered mailto: links",
    icon: Cpu,
    features: [
      "Everything in Web Scrape, plus:",
      "Playwright Chromium executes JavaScript",
      "Finds emails hidden behind React/Vue/Svelte",
      "Apollo.io owner email lookup for named owners",
      "~3× higher email hit rate on modern venue sites",
    ],
    badge: "Pro",
    badgeColor: "bg-purple-bg text-purple border-purple/30",
    requiredPlan: "pro",
    cost: "Pro plan",
  },
  {
    id: "premium",
    name: "Talent Buyer Lookup",
    tagline: "Named decision-makers from Booking-Agent.io",
    icon: Star,
    features: [
      "Everything in Deep Scrape, plus:",
      "Named talent buyer, owner, or event coordinator",
      "Verified direct email and phone number",
      "Job title and seniority data",
      "Best fit for MUSIC_CLUB and A-tier leads",
      "~$0.25–0.50 per lookup (billed at cost)",
    ],
    badge: "Pro+",
    badgeColor: "bg-amber-bg text-amber border-amber/30",
    requiredPlan: "pro",
    cost: "Per lookup",
  },
];

const PLAN_ORDER = { starter: 0, pro: 1, agency: 2 };

export function EnrichModal({ artistPlan, onSelect, onClose }: Props) {
  const [selected, setSelected] = useState<EnrichTier>("free");

  function isLocked(tier: TierDef): boolean {
    return PLAN_ORDER[artistPlan] < PLAN_ORDER[tier.requiredPlan];
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-background rounded-lg shadow-xl w-full max-w-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <h2 className="text-base font-semibold text-text">Enrich contacts</h2>
            <p className="text-xs text-text-light mt-0.5">
              Choose how deeply to search for venue emails and decision-makers.
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-text-light hover:text-text">
            <X size={15} />
          </button>
        </div>

        {/* Tier cards */}
        <div className="px-5 py-4 space-y-2">
          {TIERS.map((tier) => {
            const locked = isLocked(tier);
            const active = selected === tier.id;
            const Icon = tier.icon;

            return (
              <button
                key={tier.id}
                type="button"
                disabled={locked}
                onClick={() => !locked && setSelected(tier.id)}
                className={`w-full text-left rounded-lg border p-4 transition-all ${
                  locked
                    ? "opacity-60 cursor-not-allowed bg-surface border-border"
                    : active
                    ? "bg-accent-blue-bg border-accent-blue shadow-sm"
                    : "bg-background border-border hover:bg-surface hover:border-border-medium"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className={`w-8 h-8 rounded-md flex items-center justify-center shrink-0 ${
                      active ? "bg-accent-blue text-white" : "bg-surface text-text-light"
                    }`}>
                      {locked ? <Lock size={14} /> : <Icon size={14} />}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-sm font-medium ${active ? "text-accent-blue" : "text-text"}`}>
                          {tier.name}
                        </span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${tier.badgeColor}`}>
                          {tier.badge}
                        </span>
                        {locked && (
                          <span className="text-[10px] text-text-light">
                            Requires {tier.requiredPlan} plan
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-text-light mt-0.5">{tier.tagline}</p>
                      <ul className="mt-2 space-y-0.5">
                        {tier.features.map((f, i) => (
                          <li key={i} className="flex items-start gap-1.5 text-xs text-text-medium">
                            <Check size={10} className="text-success-green shrink-0 mt-0.5" />
                            {f}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <span className="text-xs text-text-light">{tier.cost}</span>
                    {active && !locked && (
                      <div className="w-4 h-4 bg-accent-blue rounded-full flex items-center justify-center mt-1 ml-auto">
                        <Check size={10} className="text-white" />
                      </div>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Nova call upsell */}
        <div className="mx-5 mb-4 border border-purple/20 bg-purple-bg rounded-lg p-3 flex items-start gap-3">
          <Phone size={14} className="text-purple shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="text-xs font-medium text-text">
              Nova AI calls — coming soon
            </p>
            <p className="text-xs text-text-light mt-0.5">
              For venues with phone but no email, Nova calls and gets the booking contact.
              Pay per call (~$0.35/venue). Pro plan + call credits required.
            </p>
          </div>
          <span className="text-[10px] px-1.5 py-0.5 rounded border bg-purple-bg text-purple border-purple/30 shrink-0 font-medium">
            Soon
          </span>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 pb-4">
          <div className="text-xs text-text-light">
            {artistPlan === "starter" && (
              <span>
                On <span className="font-medium text-text">Starter</span> ·{" "}
                <a href="/settings" className="text-accent-blue hover:underline">
                  Upgrade to Pro →
                </a>
              </span>
            )}
            {artistPlan === "pro" && (
              <span className="text-success-green">✓ Pro — all tiers unlocked</span>
            )}
          </div>
          <Button variant="primary" size="sm" onClick={() => onSelect(selected)}>
            <Zap size={13} />
            Start enrichment
          </Button>
        </div>
      </div>
    </div>
  );
}
