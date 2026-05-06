"use client";

import type { DealResponse } from "@/types/api";
import { useI18n } from "@/components/providers/app-providers";
import { SectionCard } from "@/components/deal/section-card";
import { StatusBadge } from "@/components/deal/status-badge";

export function DealStatusCard({ deal }: { deal: DealResponse }) {
  const { t } = useI18n();

  return (
    <SectionCard
      title={t("deal.section.next_action")}
      description={t("common.keep_link_safe")}
      action={<StatusBadge status={deal.status} />}
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <Metric label={t("deal.section.product")} value={deal.product?.title || "--"} />
        <Metric label={t("deal.role.buyer")} value={deal.participants.find((item) => item.role === "buyer")?.name || "--"} />
        <Metric label={t("deal.role.seller")} value={deal.participants.find((item) => item.role === "seller")?.name || "--"} />
      </div>
    </SectionCard>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-3">
      <div className="text-xs font-medium text-[var(--ink-soft)]">{label}</div>
      <div className="mt-1 text-sm font-semibold text-[var(--ink)]">{value}</div>
    </div>
  );
}
