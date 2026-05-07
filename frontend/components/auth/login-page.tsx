"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/providers/app-providers";
import { Button } from "@/components/ui/button";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3003/v1";
const BACKEND_BASE = API_BASE.replace("/v1", "");

// ─── Auth API calls ───────────────────────────────────────────────────────────

async function apiRegister(email: string, password: string, name: string) {
  const res = await fetch(`${API_BASE}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, name }),
    credentials: "include",
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message ?? "Registration failed");
  return data as { user: { id: string; email: string | null; name: string | null; avatarUrl: string | null; emailVerified: boolean } };
}

async function apiLogin(email: string, password: string) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
    credentials: "include",
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message ?? "Login failed");
  return data as { user: { id: string; email: string | null; name: string | null; avatarUrl: string | null; emailVerified: boolean } };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function TelegramButton({ redirectAfter }: { redirectAfter: string }) {
  const handleClick = () => {
    const url = `${BACKEND_BASE}/v1/auth/telegram/authorize?redirectAfter=${encodeURIComponent(redirectAfter)}`;
    window.location.href = url;
  };

  return (
    <Button
      onClick={handleClick}
      variant="primary"
      className="w-full flex items-center justify-center gap-2 mb-3"
      id="btn-telegram-login"
    >
      <div className="w-5 h-5 flex items-center justify-center"><TelegramIcon /></div>
      <span>Continue with Telegram</span>
    </Button>
  );
}

function GoogleButton({ redirectAfter }: { redirectAfter: string }) {
  const handleClick = () => {
    const url = `${BACKEND_BASE}/v1/auth/google/authorize?redirectAfter=${encodeURIComponent(redirectAfter)}`;
    window.location.href = url;
  };

  return (
    <Button
      onClick={handleClick}
      variant="secondary"
      className="w-full flex items-center justify-center gap-2 mb-3"
      id="btn-google-login"
    >
      <div className="w-5 h-5 flex items-center justify-center"><GoogleIcon /></div>
      <span>Continue with Google</span>
    </Button>
  );
}

function EmailForm({
  redirectAfter,
  onSuccess,
}: {
  redirectAfter: string;
  onSuccess: (user: { id: string; email: string | null; name: string | null; avatarUrl: string | null; emailVerified: boolean }) => void;
}) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    startTransition(async () => {
      try {
        const result =
          mode === "register"
            ? await apiRegister(email, password, name)
            : await apiLogin(email, password);
        onSuccess(result.user);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="auth-email-form mt-4">
      {mode === "register" && (
        <div className="auth-field mb-4">
          <label htmlFor="auth-name" className="block text-sm font-medium text-[var(--ink)] mb-1">Full Name</label>
          <input
            id="auth-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            autoComplete="name"
            className="w-full px-3 py-2 border border-[var(--border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--brand)]"
          />
        </div>
      )}

      <div className="auth-field mb-4">
        <label htmlFor="auth-email" className="block text-sm font-medium text-[var(--ink)] mb-1">Email</label>
        <input
          id="auth-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          required
          autoComplete="email"
          className="w-full px-3 py-2 border border-[var(--border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--brand)]"
        />
      </div>

      <div className="auth-field mb-4">
        <label htmlFor="auth-password" className="block text-sm font-medium text-[var(--ink)] mb-1">Password</label>
        <input
          id="auth-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={mode === "register" ? "At least 8 characters" : "Your password"}
          required
          autoComplete={mode === "register" ? "new-password" : "current-password"}
          minLength={mode === "register" ? 8 : 1}
          className="w-full px-3 py-2 border border-[var(--border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--brand)]"
        />
      </div>

      {error && <p className="auth-error text-[var(--danger)] text-sm mb-4">{error}</p>}

      <Button
        type="submit"
        disabled={isPending}
        className="w-full"
        id={`btn-${mode}-submit`}
      >
        {isPending
          ? "Please wait…"
          : mode === "register"
          ? "Create Account"
          : "Sign In"}
      </Button>

      <p className="auth-toggle text-center mt-4 text-sm text-[var(--ink-muted)]">
        {mode === "login" ? (
          <>
            No account?{" "}
            <button
              type="button"
              onClick={() => { setMode("register"); setError(""); }}
              className="text-[var(--brand)] font-semibold hover:underline"
              id="btn-switch-register"
            >
              Sign up
            </button>
          </>
        ) : (
          <>
            Already have an account?{" "}
            <button
              type="button"
              onClick={() => { setMode("login"); setError(""); }}
              className="text-[var(--brand)] font-semibold hover:underline"
              id="btn-switch-login"
            >
              Sign in
            </button>
          </>
        )}
      </p>
    </form>
  );
}

// ─── Main Login Page Component ────────────────────────────────────────────────

export function LoginPageComponent() {
  const { setUser } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirectTo") ?? "/";

  const handleEmailSuccess = (user: {
    id: string;
    email: string | null;
    name: string | null;
    avatarUrl: string | null;
    emailVerified: boolean;
  }) => {
    setUser(user);
    router.push(redirectTo);
  };

  return (
    <div className="auth-page flex min-h-screen items-center justify-center px-4 py-12">
      {/* Background elements */}
      <div className="auth-bg absolute inset-0 -z-10 overflow-hidden">
        <div className="auth-bg-orb auth-bg-orb-1" />
        <div className="auth-bg-orb auth-bg-orb-2" />
        <div className="auth-bg-orb auth-bg-orb-3" />
      </div>

      <div className="auth-card bg-white w-full max-w-md p-8 rounded-2xl shadow-xl border border-[var(--border)]">
        {/* Logo / Brand */}
        <div className="auth-brand flex flex-col items-center mb-8">
          <div className="auth-brand-icon w-12 h-12 text-[var(--brand)] mb-4">
            <ShieldIcon />
          </div>
          <h1 className="auth-brand-name text-2xl font-bold text-[var(--ink)] mb-2">BothSafe</h1>
          <p className="auth-brand-tagline text-[var(--ink-muted)] text-center">Sign in to protect your deals</p>
        </div>

        {/* Auth Methods List */}
        <div className="flex flex-col w-full">
          <TelegramButton redirectAfter={redirectTo} />
          <GoogleButton redirectAfter={redirectTo} />
          
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-[var(--border)]" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-2 text-[var(--ink-muted)]">
                Or continue with email
              </span>
            </div>
          </div>
          
          <EmailForm redirectAfter={redirectTo} onSuccess={handleEmailSuccess} />
        </div>

        {/* Footer */}
        <p className="auth-footer text-center text-xs text-[var(--ink-muted)] mt-8">
          By signing in, you agree to BothSafe&apos;s terms of service and privacy policy.
        </p>
      </div>
    </div>
  );
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function ShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" className="w-full h-full">
      <path
        d="M12 2L4 5v6c0 5.25 3.5 10.15 8 11.35C16.5 21.15 20 16.25 20 11V5l-8-3z"
        fill="currentColor"
        opacity="0.2"
      />
      <path
        d="M12 2L4 5v6c0 5.25 3.5 10.15 8 11.35C16.5 21.15 20 16.25 20 11V5l-8-3z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9 12l2 2 4-4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TelegramIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" className="w-full h-full">
      <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12l-6.871 4.326-2.962-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.833.941z" />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" className="w-full h-full">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}
