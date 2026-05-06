import { formatCurrency, formatDateTime, resolveFileUrl } from "@/lib/utils";
import type { AdminDealDetail } from "@/types/api";

export function PaymentProofViewer({ deal }: { deal: AdminDealDetail }) {
  const payment = deal.payments.at(-1);
  if (!payment) {
    return (
      <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-4 text-sm text-[var(--ink-soft)]">
        No payment proof yet.
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Info label="Status" value={payment.adminStatus} />
        <Info
          label="Paid amount"
          value={formatCurrency(payment.paidAmount, deal.currency)}
        />
        <Info
          label="Expected amount"
          value={formatCurrency(payment.expectedAmount, deal.currency)}
        />
        <Info label="Submitted" value={formatDateTime(payment.createdAt)} />
      </div>
      {payment.proofImageUrl ? (
        <img
          src={resolveFileUrl(payment.proofImageUrl) ?? ""}
          alt=""
          className="max-h-80 rounded-lg border border-[var(--border)] object-contain"
        />
      ) : null}
      {payment.rejectedReason ? (
        <p className="text-sm text-[var(--danger)]">{payment.rejectedReason}</p>
      ) : null}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-[var(--ink-soft)]">{label}</div>
      <div className="mt-1 text-sm font-medium text-[var(--ink)]">{value}</div>
    </div>
  );
}
