import { cn } from "@/lib/utils";

export function Field({
  label,
  hint,
  error,
  required,
  children,
}: {
  label: string;
  hint?: string | null;
  error?: string | null;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-2 text-sm text-[var(--ink)]">
      <span className="flex items-center gap-2 font-medium">
        {label}
        {required ? (
          <span className="text-xs text-[var(--warning)]">*</span>
        ) : null}
      </span>
      {children}
      {hint ? (
        <span className="text-xs text-[var(--ink-soft)]">{hint}</span>
      ) : null}
      {error ? (
        <span className={cn("text-xs font-medium text-[var(--danger)]")}>
          {error}
        </span>
      ) : null}
    </label>
  );
}
