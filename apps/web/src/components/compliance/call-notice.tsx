import { Info } from "lucide-react";

// Persistent reminder on calling surfaces. Email is the safe cold channel;
// AI calls should target warm/consented leads.
export function CallNotice() {
  return (
    <div className="flex items-start gap-2 text-[11px] text-text-light border border-amber/30 bg-amber-bg rounded-lg px-3 py-2">
      <Info size={13} className="text-amber mt-0.5 shrink-0" />
      <span>
        AI calls are TCPA-regulated. Prefer <strong className="text-text-medium">warm leads</strong> (replied / interested /
        booking lines); use <strong className="text-text-medium">email</strong> for cold outreach. You attest a lawful basis each time.
      </span>
    </div>
  );
}
