"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PublicHeader } from "@/components/layout/public-header";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/components/providers/app-providers";

export function AdminLoginForm() {
  const router = useRouter();
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleLogin() {
    if (!email || !password) return;
    setPending(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        setError(data?.error ?? t("errors.auth.unauthorized"));
        return;
      }

      router.push("/admin/deals");
      router.refresh();
    } catch {
      setError("Unable to connect. Please check the server is running.");
    } finally {
      setPending(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") void handleLogin();
  }

  return (
    <div className="min-h-screen">
      <PublicHeader />
      <main className="container-shell flex justify-center py-12">
        <section className="soft-card w-full max-w-md rounded-lg p-6">
          <span className="eyebrow">{t("admin.login.title")}</span>
          <h1 className="mt-3 text-3xl font-semibold text-[var(--ink)]">
            {t("admin.login.title")}
          </h1>
          <div className="mt-6 space-y-4">
            <Field label={t("admin.login.email")} required>
              <Input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                onKeyDown={handleKeyDown}
                autoComplete="email"
              />
            </Field>
            <Field label={t("admin.login.password")} required>
              <Input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                onKeyDown={handleKeyDown}
                autoComplete="current-password"
              />
            </Field>
            {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
            <Button className="w-full" onClick={handleLogin} disabled={pending}>
              {t("admin.login.submit")}
            </Button>
          </div>
        </section>
      </main>
    </div>
  );
}
