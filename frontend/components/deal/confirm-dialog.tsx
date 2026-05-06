"use client";

import { Button } from "@/components/ui/button";

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  pending,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  pending?: boolean;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-end bg-black/30 p-4 sm:items-center sm:justify-center">
      <div className="w-full max-w-md rounded-lg border border-[var(--border)] bg-[var(--surface-strong)] p-5 shadow-xl">
        <h2 className="text-lg font-semibold text-[var(--ink)]">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-[var(--ink-soft)]">{description}</p>
        <div className="mt-5 flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button className="flex-1" onClick={onConfirm} disabled={pending}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
