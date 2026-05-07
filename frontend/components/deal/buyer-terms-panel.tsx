'use client';

import { useState } from 'react';
import { Shield } from 'lucide-react';

type Props = {
  amount: number | null;
  currency: string;
  locale: string;
  onAgreed: () => void;
};

export function BuyerTermsPanel({ amount, currency, locale, onAgreed }: Props) {
  const [checked, setChecked] = useState(false);
  const fmt = (v: number | null) => v != null ? new Intl.NumberFormat(locale, { style: 'currency', currency: currency || 'USD' }).format(v) : '--';

  return (
    <div className="rounded-2xl border border-[rgba(47,106,82,0.25)] bg-[rgba(47,106,82,0.04)] p-6 space-y-4">
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-[rgba(47,106,82,0.12)] p-2.5">
          <Shield className="h-5 w-5 text-[var(--brand)]" />
        </div>
        <div>
          <h3 className="font-bold text-[var(--ink)]">BothSafe Escrow Protection</h3>
          <p className="text-xs text-[var(--ink-soft)]">Please read before paying</p>
        </div>
      </div>

      <div className="space-y-2 text-sm text-[var(--ink-soft)]">
        <p>💰 <strong className="text-[var(--ink)]">Your {fmt(amount)} goes to BothSafe escrow</strong> — not directly to the seller.</p>
        <p>✅ <strong className="text-[var(--ink)]">If seller does not accept</strong>, you can cancel and get a full refund.</p>
        <p>🔒 <strong className="text-[var(--ink)]">After seller accepts</strong>, cancellation is locked — refund only through dispute.</p>
        <p>📋 <strong className="text-[var(--ink)]">Disputes require proof</strong> — photos, chat screenshots, and description.</p>
        <p>⚖️ <strong className="text-[var(--ink)]">BothSafe admin</strong> makes the final decision in all disputes.</p>
      </div>

      <label className="flex items-start gap-3 cursor-pointer rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] p-3 transition hover:border-[var(--brand)]">
        <input
          type="checkbox"
          checked={checked}
          onChange={e => { setChecked(e.target.checked); if (e.target.checked) onAgreed(); }}
          className="mt-0.5 h-4 w-4 rounded accent-[var(--brand)]"
        />
        <span className="text-sm text-[var(--ink)]">
          I understand and agree to the BothSafe escrow terms
        </span>
      </label>
    </div>
  );
}
