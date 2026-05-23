"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Mail,
  Phone,
  Shield,
  ShieldOff,
  CheckCircle,
  XCircle,
  ArrowLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  adminDisableUser,
  adminEnableUser,
  type AdminUserDetailResponse,
} from "@/lib/api";
import { formatMinor } from "@/lib/wallet-format";
import { formatCurrency, formatDateTime } from "@/lib/utils";

export function AdminUserDetail({
  detail,
}: {
  detail: AdminUserDetailResponse;
}) {
  const router = useRouter();
  const [user, setUser] = useState(detail.user);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggleDisabled() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      if (user.disabled) {
        const updated = await adminEnableUser(user.id);
        setUser(updated);
      } else {
        const reason =
          window.prompt(
            `Disable ${user.email ?? user.name ?? user.id}? Optional reason:`,
            "",
          ) ?? undefined;
        if (reason === undefined) return;
        const updated = await adminDisableUser(user.id, reason);
        setUser(updated);
      }
      router.refresh();
    } catch (err) {
      setError((err as Error).message ?? "Action failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <Link
        href="/admin/users"
        className="inline-flex items-center gap-1 text-sm text-[var(--brand)]"
      >
        <ArrowLeft className="h-4 w-4" /> Back to users
      </Link>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface-strong)] p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold text-[var(--ink)]">
                {user.name ?? user.email ?? user.id}
              </h1>
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
                  user.role === "ADMIN"
                    ? "bg-amber-100 text-amber-800"
                    : "bg-slate-100 text-slate-700"
                }`}
              >
                {user.role === "ADMIN" ? <Shield className="h-3 w-3" /> : null}
                {user.role}
              </span>
              {user.disabled && (
                <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
                  <ShieldOff className="h-3 w-3" /> Disabled
                </span>
              )}
            </div>
            <dl className="grid grid-cols-1 gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
              {user.email && (
                <div className="flex items-center gap-2 text-[var(--ink-soft)]">
                  <Mail className="h-4 w-4" />
                  <span className="text-[var(--ink)]">{user.email}</span>
                  {user.email_verified ? (
                    <CheckCircle className="h-3.5 w-3.5 text-emerald-600" />
                  ) : (
                    <XCircle className="h-3.5 w-3.5 text-amber-600" />
                  )}
                </div>
              )}
              {user.phone && (
                <div className="flex items-center gap-2 text-[var(--ink-soft)]">
                  <Phone className="h-4 w-4" />
                  <span className="text-[var(--ink)]">{user.phone}</span>
                </div>
              )}
              <div className="text-[var(--ink-soft)]">
                <span>User ID: </span>
                <span className="font-mono text-xs text-[var(--ink)]">
                  {user.id}
                </span>
              </div>
              <div className="text-[var(--ink-soft)]">
                <span>Joined: </span>
                <span className="text-[var(--ink)]">
                  {formatDateTime(user.created_at)}
                </span>
              </div>
            </dl>
          </div>
          {user.role !== "ADMIN" && (
            <Button
              variant={user.disabled ? "primary" : "danger"}
              onClick={() => void toggleDisabled()}
              disabled={busy}
            >
              {user.disabled ? "Re-enable account" : "Disable account"}
            </Button>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface-strong)] p-6">
        <h2 className="text-lg font-semibold text-[var(--ink)]">Wallet</h2>
        {detail.wallet ? (
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <Stat
              label="USD available"
              value={formatMinor(detail.wallet.available_usd_minor, "USD")}
            />
            <Stat
              label="KHR available"
              value={formatMinor(detail.wallet.available_khr_minor, "KHR")}
            />
            <Stat
              label="USD effective (after locks)"
              value={formatMinor(detail.wallet.effective_usd_minor, "USD")}
            />
            <Stat
              label="KHR effective (after locks)"
              value={formatMinor(detail.wallet.effective_khr_minor, "KHR")}
            />
          </div>
        ) : (
          <p className="mt-2 text-sm text-[var(--ink-soft)]">
            This user has no wallet yet.
          </p>
        )}
      </section>

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface-strong)] p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[var(--ink)]">
            Recent withdrawals
          </h2>
          <Link
            href={`/admin/withdrawals?status=PENDING_REVIEW`}
            className="text-xs text-[var(--brand)]"
          >
            All withdrawals →
          </Link>
        </div>
        {detail.recent_withdrawals.length === 0 ? (
          <p className="mt-2 text-sm text-[var(--ink-soft)]">
            No withdrawal requests yet.
          </p>
        ) : (
          <table className="mt-3 w-full text-left text-sm">
            <thead className="text-xs uppercase text-[var(--ink-soft)]">
              <tr>
                <th className="py-2">Public ID</th>
                <th className="py-2">Amount</th>
                <th className="py-2">Status</th>
                <th className="py-2">Created</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {detail.recent_withdrawals.map((w) => (
                <tr key={w.id} className="border-t border-[var(--border)]">
                  <td className="py-2 font-mono text-xs">{w.public_id}</td>
                  <td className="py-2">{formatMinor(w.amount_minor, w.currency)}</td>
                  <td className="py-2">{w.status}</td>
                  <td className="py-2 text-xs text-[var(--ink-soft)]">
                    {formatDateTime(w.created_at)}
                  </td>
                  <td className="py-2 text-right">
                    <Link
                      href={`/admin/withdrawals/${w.id}`}
                      className="text-xs text-[var(--brand)]"
                    >
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface-strong)] p-6">
        <h2 className="text-lg font-semibold text-[var(--ink)]">
          Recent deals
        </h2>
        {detail.recent_deals.length === 0 ? (
          <p className="mt-2 text-sm text-[var(--ink-soft)]">No deals yet.</p>
        ) : (
          <table className="mt-3 w-full text-left text-sm">
            <thead className="text-xs uppercase text-[var(--ink-soft)]">
              <tr>
                <th className="py-2">Public ID</th>
                <th className="py-2">Title</th>
                <th className="py-2">Role</th>
                <th className="py-2">Amount</th>
                <th className="py-2">Status</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {detail.recent_deals.map((d) => (
                <tr key={d.id} className="border-t border-[var(--border)]">
                  <td className="py-2 font-mono text-xs">{d.public_id}</td>
                  <td className="py-2">{d.title ?? "—"}</td>
                  <td className="py-2 capitalize">{d.my_role ?? "—"}</td>
                  <td className="py-2">{formatCurrency(d.amount, d.currency)}</td>
                  <td className="py-2">{d.status}</td>
                  <td className="py-2 text-right">
                    <Link
                      href={`/admin/deals/${d.id}`}
                      className="text-xs text-[var(--brand)]"
                    >
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-4">
      <p className="text-xs uppercase tracking-wide text-[var(--ink-soft)]">
        {label}
      </p>
      <p className="mt-1 text-lg font-semibold text-[var(--ink)]">{value}</p>
    </div>
  );
}
