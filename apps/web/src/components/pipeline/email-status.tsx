import { cn } from "@/lib/utils";
import { Mail, MailOpen, MousePointerClick } from "lucide-react";
import type { OutreachStatus } from "@/lib/types";

interface EmailStatusProps {
  status: OutreachStatus | null;
  openedAt?: string | null;
  className?: string;
}

export function EmailStatus({ status, openedAt, className }: EmailStatusProps) {
  if (!status || status === "QUEUED") {
    return <span className={cn("text-text-light text-xs", className)}>—</span>;
  }

  if (status === "OPTED_OUT") {
    return (
      <span className={cn("text-xs text-red-400 flex items-center gap-1", className)}>
        <Mail size={12} />
        Opted out
      </span>
    );
  }

  if (status === "OPENED" || status === "CLICKED" || status === "REPLIED") {
    return (
      <span
        className={cn(
          "text-xs flex items-center gap-1",
          status === "REPLIED" ? "text-success-green" : "text-amber",
          className
        )}
      >
        {status === "CLICKED" || status === "REPLIED" ? (
          <MousePointerClick size={12} />
        ) : (
          <MailOpen size={12} />
        )}
        {status === "REPLIED" ? "Replied" : status === "CLICKED" ? "Clicked" : "Opened"}
      </span>
    );
  }

  return (
    <span className={cn("text-xs text-text-medium flex items-center gap-1", className)}>
      <Mail size={12} />
      Sent
    </span>
  );
}
