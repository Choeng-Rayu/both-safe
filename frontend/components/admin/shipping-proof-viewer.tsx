import { resolveFileUrl } from "@/lib/utils";
import type { AdminDealDetail } from "@/types/api";

export function ShippingProofViewer({ deal }: { deal: AdminDealDetail }) {
  if (!deal.shipping) {
    return (
      <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-4 text-sm text-[var(--ink-soft)]">
        No shipping proof yet.
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Info label="Delivery company" value={deal.shipping.deliveryCompany || "--"} />
        <Info label="Tracking number" value={deal.shipping.trackingNumber || "--"} />
      </div>
      {deal.shipping.packagePhotoUrl ? (
        <img
          src={resolveFileUrl(deal.shipping.packagePhotoUrl) ?? ""}
          alt=""
          className="max-h-80 rounded-lg border border-[var(--border)] object-contain"
        />
      ) : null}
      {deal.shipping.deliveryReceiptUrl ? (
        <img
          src={resolveFileUrl(deal.shipping.deliveryReceiptUrl) ?? ""}
          alt=""
          className="max-h-80 rounded-lg border border-[var(--border)] object-contain"
        />
      ) : null}
      {deal.shipping.sellerNote ? (
        <p className="text-sm text-[var(--ink-soft)]">{deal.shipping.sellerNote}</p>
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
