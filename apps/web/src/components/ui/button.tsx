import { cn } from "@/lib/utils";
import { type ButtonHTMLAttributes, forwardRef } from "react";

type ButtonVariant = "default" | "primary" | "ghost" | "destructive";
type ButtonSize = "sm" | "md" | "lg";

const variantStyles: Record<ButtonVariant, string> = {
  default:
    "bg-surface border border-border text-text hover:bg-surface-hover active:bg-border",
  primary:
    "bg-accent-blue text-white hover:bg-accent-blue/90 active:bg-accent-blue/80",
  ghost: "text-text-medium hover:bg-surface-hover active:bg-border",
  destructive: "bg-red-50 text-red-600 border border-red-200 hover:bg-red-100",
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: "h-7 px-2.5 text-xs gap-1.5",
  md: "h-8 px-3 text-sm gap-2",
  lg: "h-9 px-4 text-sm gap-2",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "default", size = "md", className, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center rounded font-medium transition-colors duration-100 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed select-none",
          variantStyles[variant],
          sizeStyles[size],
          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
