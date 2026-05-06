"use client";

import { AlertCircle } from "lucide-react";
import { useI18n } from "@/components/providers/app-providers";
import { SectionCard } from "@/components/deal/section-card";

export function MissingFieldsChecklist({ items }: { items: string[] }) {
  const { t } = useI18n();

  return (
    <SectionCard title={t("deal.missing.title")}>
      {items.length ? (
        <ul className="space-y-3">
          {items.map((item) => (
            <li
              key={item}
              className="flex items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-sm text-[var(--ink)]"
            >
              <AlertCircle className="h-4 w-4 text-[var(--warning)]" aria-hidden="true" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-[var(--ink-soft)]">Everything needed is already here.</p>
      )}
    </SectionCard>
  );
}
