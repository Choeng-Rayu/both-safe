import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { LanguageSwitcher } from "@/components/deal/language-switcher";

export function PublicHeader() {
  return (
    <header className="border-b border-[var(--border)] bg-[var(--surface-strong)]/95 backdrop-blur">
      <div className="container-shell flex min-h-18 items-center justify-between gap-4 py-4">
        <Link
          href="/"
          className="focus-ring inline-flex items-center gap-3 rounded-lg"
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--brand)] text-white">
            <ShieldCheck className="h-5 w-5" aria-hidden="true" />
          </span>
          <span>
            <span className="block text-base font-semibold text-[var(--ink)]">
              BothSafe
            </span>
            <span className="block text-xs text-[var(--ink-soft)]">
              Protected deal rooms
            </span>
          </span>
        </Link>
        <LanguageSwitcher />
      </div>
    </header>
  );
}
