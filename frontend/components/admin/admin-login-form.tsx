"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Deprecated. The platform now uses a single login form for both
 * users and admins. This component just redirects callers back to
 * `/login` so any stale links or bookmarks keep working.
 */
export function AdminLoginForm() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/login?redirectTo=%2Fadmin%2Fusers");
  }, [router]);

  return (
    <main className="container-shell flex justify-center py-12">
      <p className="text-sm text-[var(--ink-soft)]">Redirecting to login…</p>
    </main>
  );
}
