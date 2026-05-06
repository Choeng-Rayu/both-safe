"use client";

import type { DealResponse } from "@/types/api";
import { useI18n } from "@/components/providers/app-providers";
import { formatCurrency } from "@/lib/utils";
import { SectionCard } from "@/components/deal/section-card";

export function PriceSummaryCard({ deal }: { deal: DealResponse }) {
  const { locale, t } = useI18n();

  return (
    <SectionCard title={t("deal.section.price")}>
      <div className="grid gap-3 sm:grid-cols-3">
        <Item
          label={t("deal.create.amount")}
          value={formatCurrency(deal.amount, deal.currency, locale)}
        />
        <Item
          label="BothSafe fee"
          value={formatCurrency(deal.fee_amount, deal.currency, locale)}
        />
        <Item
          label="Seller receives"
          value={formatCurrency(deal.net_seller_amount, deal.currency, locale)}
        />
      </div>
    </SectionCard>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-4">
      <div className="text-xs text-[var(--ink-soft)]">{label}</div>
      <div className="mt-1 text-base font-semibold text-[var(--ink)]">{value}</div>
    </div>
  );
}
