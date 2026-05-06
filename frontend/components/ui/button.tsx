import { forwardRef } from "react";
import { cn } from "@/lib/utils";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, type = "button", variant = "primary", ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(
        "focus-ring inline-flex min-h-11 items-center justify-center rounded-lg px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60",
        variant === "primary" &&
          "bg-[var(--brand)] text-white hover:bg-[var(--brand-strong)]",
        variant === "secondary" &&
          "border border-[var(--border)] bg-[var(--surface-muted)] text-[var(--ink)] hover:border-[var(--border-strong)]",
        variant === "ghost" &&
          "bg-transparent text-[var(--brand-strong)] hover:bg-[rgba(47,106,82,0.08)]",
        variant === "danger" && "bg-[var(--danger)] text-white hover:opacity-90",
        className,
      )}
      {...props}
    />
  ),
);

Button.displayName = "Button";
