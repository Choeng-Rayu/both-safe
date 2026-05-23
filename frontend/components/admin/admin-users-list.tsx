"use client";

import { useCallback, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, Shield, ShieldOff, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  adminListUsers,
  adminDisableUser,
  adminEnableUser,
  type AdminUserListItem,
} from "@/lib/api";
import { formatMinor } from "@/lib/wallet-format";

interface ListResponse {
  items: AdminUserListItem[];
  total: number;
  page: number;
  pageSize: number;
}

interface Filters {
  search: string;
  role: "USER" | "ADMIN" | "all";
  status: "all" | "active" | "disabled";
}

export function AdminUsersList({
  initial,
  initialFilters,
}: {
  initial: ListResponse;
  initialFilters: Filters;
}) {
  const router = useRouter();
  const [data, setData] = useState<ListResponse>(initial);
  const [filters, setFilters] = useState<Filters>(initialFilters);
  const [error, setError] = useState<string | null>(null);
  const [pendingTransition, startTransition] = useTransition();
  const [busyUserId, setBusyUserId] = useState<string | null>(null);

  const refresh = useCallback(
    async (next: Filters, page = 1) => {
      try {
        setError(null);
        const result = await adminListUsers({
          search: next.search.trim() || undefined,
          role: next.role,
          status: next.status,
          page: String(page),
          pageSize: "25",
        });
        setData(result);
        // Push search state to the URL for shareable links.
        const params = new URLSearchParams();
        if (next.search.trim()) params.set("search", next.search.trim());
        if (next.role !== "all") params.set("role", next.role);
        if (next.status !== "all") params.set("status", next.status);
        if (page > 1) params.set("page", String(page));
        const qs = params.toString();
        router.replace(`/admin/users${qs ? `?${qs}` : ""}`);
      } catch (err) {
        setError((err as Error).message ?? "Failed to load users");
      }
    },
    [router],
  );

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    startTransition(() => void refresh(filters, 1));
  }

  async function handleToggleDisabled(user: AdminUserListItem) {
    if (busyUserId) return;
    setBusyUserId(user.id);
    setError(null);
    try {
      if (user.disabled) {
        await adminEnableUser(user.id);
      } else {
        const reason =
          window.prompt(
            `Disable ${user.email ?? user.name ?? user.id}? Optional reason:`,
            "",
          ) ?? undefined;
        if (reason === undefined) {
          return; // user cancelled
        }
        await adminDisableUser(user.id, reason);
      }
      await refresh(filters, data.page);
    } catch (err) {
      setError((err as Error).message ?? "Action failed");
    } finally {
      setBusyUserId(null);
    }
  }

  const lastPage = Math.max(1, Math.ceil(data.total / data.pageSize));

  return (
    <div className="space-y-4">
      <form
        onSubmit={handleSubmit}
        className="flex flex-wrap items-end gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] p-4"
      >
        <label className="flex flex-1 min-w-[220px] flex-col gap-1.5 text-sm">
          <span className="font-medium text-[var(--ink)]">Search</span>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--ink-soft)]" />
            <input
              type="search"
              value={filters.search}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, search: e.target.value }))
              }
              placeholder="Email, name, phone, or user id"
              className="w-full rounded-lg border border-[var(--border)] bg-white px-9 py-2 text-sm"
            />
          </div>
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-[var(--ink)]">Role</span>
          <select
            value={filters.role}
            onChange={(e) =>
              setFilters((prev) => ({
                ...prev,
                role: e.target.value as Filters["role"],
              }))
            }
            className="rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm"
          >
            <option value="all">All roles</option>
            <option value="USER">User</option>
            <option value="ADMIN">Admin</option>
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-[var(--ink)]">Status</span>
          <select
            value={filters.status}
            onChange={(e) =>
              setFilters((prev) => ({
                ...prev,
                status: e.target.value as Filters["status"],
              }))
            }
            className="rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm"
          >
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="disabled">Disabled</option>
          </select>
        </label>
        <Button type="submit" disabled={pendingTransition}>
          Apply
        </Button>
      </form>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface-strong)]">
        <table className="w-full text-left text-sm">
          <thead className="bg-[var(--surface-muted)] text-xs uppercase text-[var(--ink-soft)]">
            <tr>
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Wallet (USD / KHR)</th>
              <th className="px-4 py-3">Deals</th>
              <th className="px-4 py-3">Withdrawals</th>
              <th className="px-4 py-3">Joined</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {data.items.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-12 text-center text-sm text-[var(--ink-soft)]"
                >
                  No users match these filters.
                </td>
              </tr>
            )}
            {data.items.map((user) => (
              <tr
                key={user.id}
                className={`border-t border-[var(--border)] ${
                  user.disabled ? "bg-red-50/40" : ""
                }`}
              >
                <td className="px-4 py-3">
                  <div className="flex flex-col">
                    <span className="font-medium text-[var(--ink)]">
                      {user.name ?? user.email ?? user.id}
                    </span>
                    {user.email && user.name && (
                      <span className="text-xs text-[var(--ink-soft)]">
                        {user.email}
                      </span>
                    )}
                    {user.phone && (
                      <span className="text-xs text-[var(--ink-soft)]">
                        {user.phone}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
                      user.role === "ADMIN"
                        ? "bg-amber-100 text-amber-800"
                        : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    {user.role === "ADMIN" ? (
                      <Shield className="h-3 w-3" />
                    ) : null}
                    {user.role}
                  </span>
                  {user.disabled && (
                    <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
                      <ShieldOff className="h-3 w-3" /> Disabled
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 font-mono text-xs">
                  {user.wallet
                    ? `${formatMinor(user.wallet.available_usd_minor, "USD")} / ${formatMinor(user.wallet.available_khr_minor, "KHR")}`
                    : "—"}
                </td>
                <td className="px-4 py-3">{user.deal_count}</td>
                <td className="px-4 py-3">{user.withdrawal_count}</td>
                <td className="px-4 py-3 text-xs text-[var(--ink-soft)]">
                  {new Date(user.created_at).toLocaleDateString()}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    {user.role !== "ADMIN" && (
                      <Button
                        variant={user.disabled ? "secondary" : "danger"}
                        onClick={() => void handleToggleDisabled(user)}
                        disabled={busyUserId === user.id}
                        className="px-3 py-1.5 text-xs"
                      >
                        {user.disabled ? "Enable" : "Disable"}
                      </Button>
                    )}
                    <Link
                      href={`/admin/users/${user.id}`}
                      className="focus-ring inline-flex h-9 items-center gap-1 rounded-lg border border-[var(--border)] px-3 text-xs font-medium text-[var(--brand-strong)]"
                    >
                      View <ChevronRight className="h-3 w-3" />
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm text-[var(--ink-soft)]">
        <span>
          Page {data.page} of {lastPage} · {data.total} users
        </span>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            disabled={data.page <= 1}
            onClick={() => void refresh(filters, data.page - 1)}
          >
            Previous
          </Button>
          <Button
            variant="ghost"
            disabled={data.page >= lastPage}
            onClick={() => void refresh(filters, data.page + 1)}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
