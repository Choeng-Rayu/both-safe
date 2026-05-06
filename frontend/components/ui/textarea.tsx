import { forwardRef } from "react";
import { cn } from "@/lib/utils";

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      "focus-ring min-h-28 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-strong)] px-3 py-2 text-sm text-[var(--ink)] placeholder:text-[var(--ink-soft)]",
      className,
    )}
    {...props}
  />
));

Textarea.displayName = "Textarea";
