"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Briefcase,
  Banknote,
  Star,
} from "lucide-react";

const TABS = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/admin/users", label: "Users", icon: Users, exact: false },
  { href: "/admin/deals", label: "Deals", icon: Briefcase, exact: false },
  {
    href: "/admin/withdrawals",
    label: "Withdrawals",
    icon: Banknote,
    exact: false,
  },
  { href: "/admin/feedback", label: "Feedback", icon: Star, exact: false },
];

/**
 * Top-of-page navigation for the admin dashboard.
 *
 * The platform's deal flow is fully automated: payments auto-verify
 * (Bakong / wallet pay) and confirm-received auto-credits the
 * seller's wallet. The admin's only money-moving action is approving
 * and completing withdrawal requests. Deals appear in the nav so the
 * admin can audit transaction history, but they are read-only.
 */
export function AdminNav() {
  const pathname = usePathname();

  function isActive(tab: (typeof TABS)[number]) {
    return tab.exact ? pathname === tab.href : pathname.startsWith(tab.href);
  }

  return (
    <nav className="flex flex-wrap gap-1 rounded-xl bg-[var(--surface-muted)] p-1">
      {TABS.map((tab) => {
        const Icon = tab.icon;
        const active = isActive(tab);
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
