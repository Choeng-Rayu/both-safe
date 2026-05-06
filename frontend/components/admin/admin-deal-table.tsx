import Link from "next/link";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import type { AdminDealRecord } from "@/types/api";

export function AdminDealTable({ deals }: { deals: AdminDealRecord[] }) {
  if (!deals.length) {
    return (
      <div className="soft-card rounded-lg p-6 text-sm text-[var(--ink-soft)]">
        No deals match this filter yet.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface-strong)]">
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-[var(--surface-muted)] text-[var(--ink-soft)]">
            <tr>
              <th className="px-4 py-3 font-medium">Public ID</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Amount</th>
              <th className="px-4 py-3 font-medium">Participants</th>
              <th className="px-4 py-3 font-medium">Created</th>
              <th className="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody>
            {deals.map((deal) => (
              <tr key={deal.id} className="border-t border-[var(--border)]">
                <td className="px-4 py-3 font-medium text-[var(--ink)]">
                  {deal.publicId}
                </td>
                <td className="px-4 py-3 text-[var(--ink-soft)]">{deal.status}</td>
                <td className="px-4 py-3 text-[var(--ink-soft)]">
                  {formatCurrency(deal.amount, deal.currency)}
                </td>
                <td className="px-4 py-3 text-[var(--ink-soft)]">
                  {deal.participants.map((item) => item.name || item.role).join(" / ")}
                </td>
                <td className="px-4 py-3 text-[var(--ink-soft)]">
                  {formatDateTime(deal.createdAt)}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/admin/deals/${deal.id}`}
                    className="focus-ring inline-flex min-h-10 items-center rounded-lg border border-[var(--border)] px-3 font-medium text-[var(--brand-strong)]"
                  >
                    Open detail
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
