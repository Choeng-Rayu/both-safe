"use client";

import { useI18n } from "@/components/providers/app-providers";
import { SectionCard } from "@/components/deal/section-card";
import { formatDateTime, parseJson } from "@/lib/utils";
import type { TimelineItem } from "@/types/api";

export function Timeline({ items }: { items: TimelineItem[] }) {
  const { locale, t } = useI18n();

  return (
    <SectionCard title={t("deal.timeline.title")}>
      {items.length ? (
        <ol className="space-y-4">
          {items.map((item) => {
            const payload = parseJson<Record<string, string>>(item.payload, {});
            return (
              <li key={item.id} className="flex gap-3">
                <span className="mt-1 h-3 w-3 rounded-full bg-[var(--brand)]" />
                <div>
                  <div className="text-sm font-medium text-[var(--ink)]">
                    {t(`timeline.${item.messageKey}`)}
                  </div>
                  {payload.reason ? (
                    <div className="mt-1 text-xs text-[var(--danger)]">
                      {payload.reason}
                    </div>
                  ) : null}
                  <div className="mt-1 text-xs text-[var(--ink-soft)]">
                    {formatDateTime(item.createdAt, locale)}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="text-sm text-[var(--ink-soft)]">{t("deal.timeline.empty")}</p>
      )}
    </SectionCard>
  );
}
