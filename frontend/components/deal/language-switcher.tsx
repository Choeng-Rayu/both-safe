"use client";

import { Languages } from "lucide-react";
import { LOCALES } from "@/lib/constants";
import { useI18n } from "@/components/providers/app-providers";
import { cn } from "@/lib/utils";

const labels = {
  km: "KM",
  en: "EN",
  zh: "中文",
} as const;

export function LanguageSwitcher() {
  const { locale, setLocale } = useI18n();

  return (
    <div className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--surface-strong)] p-1">
      <span className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--ink-soft)]">
        <Languages className="h-4 w-4" aria-hidden="true" />
      </span>
      {LOCALES.map((value) => (
        <button
          key={value}
          type="button"
          onClick={() => setLocale(value)}
          className={cn(
            "focus-ring min-h-9 rounded-full px-3 text-xs font-semibold transition",
            locale === value
              ? "bg-[var(--brand)] text-white"
              : "text-[var(--ink-soft)] hover:bg-[var(--surface-muted)]",
          )}
          aria-pressed={locale === value}
        >
          {labels[value]}
        </button>
      ))}
    </div>
  );
}
