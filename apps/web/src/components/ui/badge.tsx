import { cn } from "@/lib/utils";

type BadgeVariant = "default" | "blue" | "green" | "purple" | "amber" | "gray";

const variantStyles: Record<BadgeVariant, string> = {
  default: "bg-surface text-text-medium border-border",
  blue: "bg-accent-blue-bg text-accent-blue border-accent-blue/20",
  green: "bg-success-green-bg text-success-green border-success-green/20",
  purple: "bg-purple-bg text-purple border-purple/20",
  amber: "bg-amber-bg text-amber border-amber/20",
  gray: "bg-surface text-text-light border-border",
};

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

export function Badge({ children, variant = "default", className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border",
        variantStyles[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
