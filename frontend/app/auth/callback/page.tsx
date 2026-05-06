"use client";

import { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/providers/app-providers";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3003/v1";

function CallbackInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setUser } = useAuth();

  const success = searchParams.get("success");
  const redirectTo = searchParams.get("redirectTo") ?? "/";
  const error = searchParams.get("error");

  useEffect(() => {
    if (error) {
      router.replace(`/login?error=${error}`);
      return;
    }

    if (success === "1") {
      // The backend already set the HttpOnly cookie.
      // Fetch current user to populate AuthContext.
      fetch(`${API_BASE}/auth/me`, { credentials: "include" })
        .then((res) => res.json())
        .then((data: { user?: { id: string; email: string | null; name: string | null; avatarUrl: string | null; emailVerified: boolean } }) => {
          if (data.user) {
            setUser(data.user);
          }
          router.replace(redirectTo);
        })
        .catch(() => {
          router.replace(redirectTo);
        });
    } else {
      router.replace("/login");
    }
  }, [success, error, redirectTo, router, setUser]);

  return (
    <div className="auth-callback-page">
      <div className="auth-callback-card">
        <div className="auth-callback-spinner" />
        <p className="auth-callback-text">
          {error ? "Something went wrong. Redirecting…" : "Logging you in…"}
        </p>
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense>
      <CallbackInner />
    </Suspense>
  );
}
