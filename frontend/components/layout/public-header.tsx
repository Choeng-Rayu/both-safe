import Link from "next/link";
import Image from "next/image";
import { LanguageSwitcher } from "@/components/deal/language-switcher";

export function PublicHeader() {
  return (
    <header className="border-b border-[var(--border)] bg-[var(--surface-strong)]/95 backdrop-blur">
      <div className="container-shell flex min-h-18 items-center justify-between gap-4 py-4">
        <Link
          href="/"
          className="focus-ring inline-flex items-center gap-3 rounded-lg"
        >
          <span className="flex items-center justify-center">
            <Image src="/logo.png" alt="BothSafe Logo" width={44} height={44} className="h-11 w-auto" />
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
