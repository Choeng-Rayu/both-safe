"use client";

import type { DealResponse } from "@/types/api";
import { SectionCard } from "@/components/deal/section-card";
import { useI18n } from "@/components/providers/app-providers";

export function ParticipantCard({
  deal,
  action,
}: {
  deal: DealResponse;
  action?: React.ReactNode;
}) {
  const { t } = useI18n();

  return (
    <SectionCard title={t("deal.section.participants")} action={action}>
      <div className="grid gap-4 md:grid-cols-2">
        {deal.participants.map((participant) => (
          <div
            key={participant.role}
            className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-4"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-semibold text-[var(--ink)]">
                {t(`deal.role.${participant.role}`)}
              </div>
              <div className="text-xs text-[var(--ink-soft)]">
                {participant.approved_at ? t("deal.action.approve") : "--"}
              </div>
            </div>
            <div className="mt-3 space-y-1 text-sm text-[var(--ink-soft)]">
              <div className="font-medium text-[var(--ink)]">
                {participant.name || "--"}
              </div>
              <div>{participant.preferred_language || "--"}</div>
              <div>
                {participant.has_payout ? "Payout ready" : "Payout pending"}
              </div>
            </div>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}
