"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/components/providers/app-providers";
import type { SessionUser } from "@/components/providers/app-providers";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001/v1";
const BACKEND_BASE = API_BASE.replace("/v1", "");

interface AuthApiResponse {
  user: SessionUser;
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
  return data as AuthApiResponse;
}

async function apiRegister(email: string, password: string, name: string) {
  const res = await fetch(`${API_BASE}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, name }),
    credentials: "include",
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message ?? "Registration failed");
  return data as AuthApiResponse;
}

interface AuthRequiredDialogProps {
  /** Whether the dialog is visible. */
  open: boolean;
  /** Called when the user dismisses the dialog (Escape, backdrop, X). */
  onClose: () => void;
  /**
   * Path to navigate to after a successful login/register. Also passed
   * to OAuth providers as `redirectAfter`. Defaults to the current page.
   */
  redirectTo?: string;
  /** Optional title override (defaults to a sign-in prompt). */
  title?: string;
  /** Optional subtitle override. */
  subtitle?: string;
  /**
   * If true, the user cannot dismiss the dialog (no X button, no
   * backdrop close, Escape ignored). Useful for pages where
   * authentication is mandatory before any interaction.
   */
  blocking?: boolean;
}

/**
 * Inline auth modal shown when an anonymous user tries to perform an
 * action that requires being signed in (e.g. creating a deal). Mirrors
 * the unified login form: email/password, OAuth, and a tab to switch
 * between sign in and create account.
 */
export function AuthRequiredDialog({
  open,
  onClose,
  redirectTo,
  title,
  subtitle,
  blocking = false,
}: AuthRequiredDialogProps) {
  const router = useRouter();
  const { setUser } = useAuth();
  const dialogRef = useRef<HTMLDivElement>(null);

  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Reset form when re-opening so old errors / inputs don't linger.
  useEffect(() => {
    if (open) {
      setError(null);
    }
  }, [open]);

  // Close on Escape unless this is a blocking dialog.
  useEffect(() => {
    if (!open || blocking) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, blocking, onClose]);

  // Lock body scroll while open.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  if (!open) return null;

  const targetRedirect =
    redirectTo ??
    (typeof window !== "undefined"
      ? window.location.pathname + window.location.search
      : "/");

  function navigateAfterAuth(user: SessionUser) {
    setUser(user);
    if (user.role === "ADMIN") {
      router.push("/admin/users");
      return;
    }
    router.push(targetRedirect);
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        const result =
          mode === "register"
            ? await apiRegister(email, password, name)
            : await apiLogin(email, password);
        navigateAfterAuth(result.user);
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      }
    });
  }

  function startOAuth(provider: "google" | "telegram") {
    const url = `${BACKEND_BASE}/v1/auth/${provider}/authorize?redirectAfter=${encodeURIComponent(targetRedirect)}`;
    window.location.href = url;
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-required-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close"
        tabIndex={blocking ? -1 : 0}
        onClick={() => {
          if (!blocking) onClose();
        }}
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
      />

      {/* Card */}
      <div
        ref={dialogRef}
        className="relative w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface-strong)] shadow-2xl"
      >
        {!blocking && (
          <button
            type="button"
            onClick={onClose}
            className="focus-ring absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-full text-[var(--ink-soft)] transition hover:bg-[var(--surface-muted)] hover:text-[var(--ink)]"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        )}

        <div className="p-6 sm:p-8">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--brand)]/10 text-[var(--brand)] border border-[var(--brand)]/20">
              <ShieldIcon />
            </div>
            <h2
              id="auth-required-title"
              className="text-2xl font-bold text-[var(--ink)]"
            >
              {title ?? "Sign in to continue"}
            </h2>
            <p className="mt-2 text-sm text-[var(--ink-soft)]">
              {subtitle ??
                "Create a BothSafe account or sign in to start a protected deal."}
            </p>
          </div>

          {/* Tab switcher */}
          <div
            role="tablist"
            className="mb-5 grid grid-cols-2 rounded-lg bg-[var(--surface-muted)] p-1"
          >
            <button
              role="tab"
              type="button"
              aria-selected={mode === "login"}
              onClick={() => {
                setMode("login");
                setError(null);
              }}
              className={`rounded-md px-3 py-2 text-sm font-semibold transition ${
                mode === "login"
                  ? "bg-[var(--surface-strong)] text-[var(--ink)] shadow-sm"
                  : "text-[var(--ink-soft)]"
              }`}
            >
              Sign in
            </button>
            <button
              role="tab"
              type="button"
              aria-selected={mode === "register"}
              onClick={() => {
                setMode("register");
                setError(null);
              }}
              className={`rounded-md px-3 py-2 text-sm font-semibold transition ${
                mode === "register"
                  ? "bg-[var(--surface-strong)] text-[var(--ink)] shadow-sm"
                  : "text-[var(--ink-soft)]"
              }`}
            >
              Create account
            </button>
          </div>

          {/* OAuth */}
          <div className="mb-5 space-y-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => startOAuth("telegram")}
              className="flex h-11 w-full items-center justify-center gap-3 bg-[#E3F2FD] text-[var(--ink)] hover:bg-[#BBDEFB]"
            >
              <span className="flex h-5 w-5 items-center justify-center text-[#1e88e5]">
                <TelegramIcon />
              </span>
              <span>Continue with Telegram</span>
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => startOAuth("google")}
              className="flex h-11 w-full items-center justify-center gap-3"
            >
              <span className="flex h-5 w-5 items-center justify-center">
                <GoogleIcon />
              </span>
              <span>Continue with Google</span>
            </Button>
          </div>

          <div className="relative my-5 flex items-center">
            <div className="flex-1 border-t border-[var(--border)]" />
            <span className="px-3 text-xs uppercase tracking-wide text-[var(--ink-soft)]">
              or with email
            </span>
            <div className="flex-1 border-t border-[var(--border)]" />
          </div>

          {/* Email + password form */}
          <form onSubmit={handleSubmit} className="space-y-3">
            {mode === "register" && (
              <Field label="Full name">
                <Input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Your name"
                  autoComplete="name"
                />
              </Field>
            )}
            <Field label="Email" required>
              <Input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                required
                autoComplete="email"
              />
            </Field>
            <Field
              label="Password"
              required
              hint={mode === "register" ? "At least 8 characters" : undefined}
            >
              <Input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder={mode === "register" ? "At least 8 characters" : "Your password"}
                required
                minLength={mode === "register" ? 8 : 1}
                autoComplete={
                  mode === "register" ? "new-password" : "current-password"
                }
              />
            </Field>

            {error && (
              <p className="rounded-lg border border-[var(--danger)]/30 bg-[var(--danger)]/10 p-3 text-sm text-[var(--danger)]">
                {error}
              </p>
            )}

            <Button
              type="submit"
              disabled={isPending}
              className="mt-2 h-11 w-full"
            >
              {isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              {mode === "register" ? "Create account" : "Sign in"}
            </Button>
          </form>

          <p className="mt-5 text-center text-xs text-[var(--ink-soft)]">
            By continuing, you agree to BothSafe&apos;s terms of service and
            privacy policy.
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Icons ────────────────────────────────────────────────────────────────

function ShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="h-7 w-7">
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
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className="h-full w-full"
    >
      <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12l-6.871 4.326-2.962-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.833.941z" />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-full w-full"
    >
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
