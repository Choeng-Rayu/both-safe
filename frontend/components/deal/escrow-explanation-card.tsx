"use client";

import { Shield } from "lucide-react";
import { SectionCard } from "@/components/deal/section-card";
import { useI18n } from "@/components/providers/app-providers";

export function EscrowExplanationCard() {
  const { t } = useI18n();

  return (
    <SectionCard
      title={t("escrow.title")}
      action={
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[rgba(47,106,82,0.12)] text-[var(--brand)]">
          <Shield className="h-5 w-5" aria-hidden="true" />
        </span>
      }
    >
      <p className="text-sm leading-6 text-[var(--ink-soft)]">{t("escrow.body")}</p>
    </SectionCard>
  );
}
