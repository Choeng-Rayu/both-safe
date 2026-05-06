"use client";

import type { DealResponse } from "@/types/api";
import { SectionCard } from "@/components/deal/section-card";
import { useI18n } from "@/components/providers/app-providers";
import { resolveFileUrl } from "@/lib/utils";

export function ProductCard({
  deal,
  action,
}: {
  deal: DealResponse;
  action?: React.ReactNode;
}) {
  const { t } = useI18n();
  const imageUrl = resolveFileUrl(deal.product?.image_url ?? null);

  return (
    <SectionCard title={t("deal.section.product")} action={action}>
      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="flex-1 space-y-2">
          <div>
            <div className="text-lg font-semibold text-[var(--ink)]">
              {deal.product?.title || "--"}
            </div>
            <div className="text-sm text-[var(--ink-soft)]">
              {deal.product?.type || "--"}
            </div>
          </div>
          <p className="text-sm leading-6 text-[var(--ink-soft)]">
            {deal.product?.description || "--"}
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Meta label="Qty" value={String(deal.product?.quantity ?? 1)} />
            <Meta label="Condition" value={deal.product?.condition || "--"} />
          </div>
        </div>
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={deal.product?.title || "Product"}
            className="h-40 w-full rounded-lg border border-[var(--border)] object-cover sm:w-48"
          />
        ) : null}
      </div>
    </SectionCard>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-3">
      <div className="text-xs text-[var(--ink-soft)]">{label}</div>
      <div className="mt-1 text-sm font-medium text-[var(--ink)]">{value}</div>
    </div>
  );
}
