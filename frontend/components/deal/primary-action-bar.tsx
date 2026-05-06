import { Button } from "@/components/ui/button";

export function PrimaryActionBar({
  primary,
  secondary,
}: {
  primary?: React.ReactNode;
  secondary?: React.ReactNode;
}) {
  if (!primary && !secondary) return null;

  return (
    <div className="sticky bottom-0 z-20 -mx-4 border-t border-[var(--border)] bg-[var(--surface-strong)]/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-lg sm:border sm:p-4">
      <div className="flex flex-col gap-3 sm:flex-row">
        {primary ? <div className="flex-1">{primary}</div> : null}
        {secondary ? <div className="sm:w-auto">{secondary}</div> : null}
      </div>
    </div>
  );
}

export function ActionButton({
  children,
  ...props
}: React.ComponentProps<typeof Button>) {
  return (
    <Button className="w-full" {...props}>
      {children}
    </Button>
  );
}
