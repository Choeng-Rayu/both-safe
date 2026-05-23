"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Users, Briefcase, Banknote } from "lucide-react";

const TABS = [
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/deals", label: "Deals", icon: Briefcase },
  { href: "/admin/withdrawals", label: "Withdrawals", icon: Banknote },
];

/**
 * Top-of-page navigation that ties together the three admin
 * dashboard sections. Each section has its own server page that
 * renders this component above its content for a consistent
 * experience.
 */
export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap gap-1 rounded-xl bg-[var(--surface-muted)] p-1">
      {TABS.map((tab) => {
        const Icon = tab.icon;
        const active = pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
              active
                ? "bg-[var(--surface-strong)] text-[var(--ink)] shadow-sm"
                : "text-[var(--ink-soft)] hover:text-[var(--ink)]"
            }`}
          >
            <Icon className="h-4 w-4" />
            <span>{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
