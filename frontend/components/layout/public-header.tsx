"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { LogOut, User } from "lucide-react";
import { LanguageSwitcher } from "@/components/deal/language-switcher";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/providers/app-providers";

export function PublicHeader() {
  const { user, logout, isLoading } = useAuth();
  const pathname = usePathname();

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
        <div className="flex items-center gap-3">
          <LanguageSwitcher />
          {user ? (
            <div className="flex items-center gap-2">
              <Link
                href="/dashboard"
                className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-[var(--ink-soft)] transition-colors hover:text-[var(--ink)]"
              >
                <User className="h-4 w-4" />
                <span className="hidden sm:inline">{user.name ?? user.email}</span>
              </Link>
              <Button
                variant="ghost"
                onClick={() => void logout()}
                disabled={isLoading}
                className="gap-1.5 text-sm"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Sign Out</span>
              </Button>
            </div>
          ) : (
            <Link href={`/login?redirectTo=${encodeURIComponent(pathname)}`}>
              <Button variant="secondary" className="text-sm">
                Sign In
              </Button>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
