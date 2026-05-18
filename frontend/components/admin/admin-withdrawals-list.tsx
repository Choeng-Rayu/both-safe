"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { adminListWithdrawals, type WithdrawalAdminDetail } from "@/lib/api";
import { formatMinor, withdrawalStatusLabel } from "@/lib/wallet-format";

interface AdminWithdrawalsListProps {
  adminToken: string;
  initialStatus?: string;
}

const STATUS_OPTIONS = [
  { value: "", label: "All" },
  { value: "PENDING_REVIEW", label: "Pending review" },
  { value: "APPROVED", label: "Approved" },
  { value: "PROCESSING", label: "Processing" },
  { value: "COMPLETED", label: "Completed" },
  { value: "REJECTED", label: "Rejected" },
  { value: "CANCELLED", label: "Cancelled" },
  { value: "FAILED", label: "Failed" },
];

export function AdminWithdrawalsList({ adminToken, initialStatus = "" }: AdminWithdrawalsListProps) {
  const [status, setStatus] = useState(initialStatus);
  const [rows, setRows] = useState<WithdrawalAdminDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await adminListWithdrawals({
        status: status || undefined,
        adminToken,
      });
      setRows(result.withdrawals);
    } catch (err) {
      setError((err as Error).message ?? "Failed to load withdrawals");
    } finally {
      setLoading(false);
    }
  }, [status, adminToken]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <label className="text-sm font-medium text-[var(--ink)]">Filter:</label>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-lg border border-[var(--border)] bg-white px-3 py-1.5 text-sm"
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <Button variant="ghost" onClick={refresh}>
          Refresh
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading && rows.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">Loading...</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">No withdrawals match this filter.</p>
      ) : (
        <table className="w-full border-collapse rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] text-sm">
          <thead className="bg-[var(--surface-soft)] text-left text-xs uppercase text-[var(--muted)]">
            <tr>
              <th className="px-3 py-2">ID</th>
              <th className="px-3 py-2">User</th>
              <th className="px-3 py-2">Amount</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Created</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((w) => (
              <tr key={w.id} className="border-t border-[var(--border)]">
                <td className="px-3 py-2 font-mono text-xs">{w.public_id}</td>
                <td className="px-3 py-2">
                  {w.user?.email ?? w.user?.name ?? w.user?.id ?? w.user_id}
                </td>
                <td className="px-3 py-2 font-semibold">
                  {formatMinor(w.amount_minor, w.currency)}
                </td>
                <td className="px-3 py-2">{withdrawalStatusLabel(w.status)}</td>
                <td className="px-3 py-2 text-[var(--muted)]">
                  {new Date(w.created_at).toLocaleString()}
                </td>
                <td className="px-3 py-2 text-right">
                  <Link href={`/admin/withdrawals/${w.id}`}>
                    <Button variant="ghost">Review</Button>
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
