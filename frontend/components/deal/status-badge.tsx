"use client";

import type { DealStatus } from "@/types/api";
import { cn } from "@/lib/utils";
import { useI18n } from "@/components/providers/app-providers";

const colorMap: Record<DealStatus, string> = {
  DRAFT: "bg-slate-100 text-slate-700",
  AWAITING_COUNTERPARTY: "bg-amber-100 text-amber-800",
  AWAITING_BOTH_APPROVAL: "bg-yellow-100 text-yellow-800",
  READY_FOR_PAYMENT: "bg-emerald-100 text-emerald-800",
  PAYMENT_PENDING_VERIFICATION: "bg-orange-100 text-orange-800",
  PAID_ESCROWED: "bg-teal-100 text-teal-800",
  SELLER_PREPARING: "bg-cyan-100 text-cyan-800",
  SHIPPED: "bg-sky-100 text-sky-800",
  BUYER_CONFIRMED: "bg-indigo-100 text-indigo-800",
  DISPUTED: "bg-red-100 text-red-800",
  RELEASE_PENDING: "bg-violet-100 text-violet-800",
  RELEASED: "bg-green-100 text-green-800",
  REFUNDED: "bg-zinc-200 text-zinc-800",
  CANCELLED: "bg-zinc-200 text-zinc-700",
  EXPIRED: "bg-zinc-200 text-zinc-700",
};

export function StatusBadge({ status }: { status: DealStatus }) {
  const { t } = useI18n();
  return (
    <span
      className={cn(
        "inline-flex min-h-9 items-center rounded-full px-3 text-xs font-semibold",
        colorMap[status] ?? "bg-zinc-100 text-zinc-700",
      )}
    >
      {t(`deal.status.${status.toLowerCase()}`)}
    </span>
  );
}
