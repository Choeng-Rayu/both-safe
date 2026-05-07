'use client';

import { useState } from 'react';
import { CheckCircle, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useI18n } from '@/components/providers/app-providers';

type Props = {
  amount: number | null;
  currency: string;
  productTitle: string | null;
  buyerName: string | null;
  pending: boolean;
  onAccept: (payload: {
    payout_khqr?: string;
    payout_bank_name?: string;
    payout_account_name?: string;
    payout_account_number?: string;
    expected_shipping_date?: string;
    delivery_company?: string;
  }) => void;
  onReject: () => void;
};

export function SellerAcceptPanel({ amount, currency, productTitle, buyerName, pending, onAccept, onReject }: Props) {
  const { locale } = useI18n();
  const [agreed, setAgreed] = useState(false);
  const [form, setForm] = useState({ payout_khqr: '', payout_bank_name: '', payout_account_name: '', payout_account_number: '', expected_shipping_date: '', delivery_company: '' });

  const fmt = (v: number | null) => v != null ? new Intl.NumberFormat(locale, { style: 'currency', currency: currency || 'USD' }).format(v) : '--';

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-strong)] p-6 shadow-lg space-y-6">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-[rgba(47,106,82,0.1)] p-3">
          <CheckCircle className="h-6 w-6 text-[var(--brand)]" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-[var(--ink)]">Deal Ready — Your Decision</h2>
          <p className="text-sm text-[var(--ink-soft)] mt-1">Payment has been verified by BothSafe. Review and accept or reject.</p>
        </div>
      </div>

      <div className="rounded-xl bg-[var(--surface-muted)] p-4 grid grid-cols-2 gap-3 text-sm">
        <div><span className="text-[var(--ink-soft)]">Buyer</span><p className="font-semibold">{buyerName || '—'}</p></div>
        <div><span className="text-[var(--ink-soft)]">Product</span><p className="font-semibold">{productTitle || '—'}</p></div>
        <div><span className="text-[var(--ink-soft)]">Amount in Escrow</span><p className="font-bold text-[var(--brand)]">{fmt(amount)}</p></div>
        <div><span className="text-[var(--ink-soft)]">Payment Status</span><p className="font-semibold text-[var(--success)]">✓ Verified</p></div>
      </div>

      <div className="space-y-3">
        <p className="text-sm font-semibold text-[var(--ink)]">Your payout details (required to receive payment):</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2"><Field label="Bakong / KHQR ID"><Textarea value={form.payout_khqr} onChange={e => setForm(f => ({ ...f, payout_khqr: e.target.value }))} placeholder="yourname@aba" /></Field></div>
          <Field label="Bank Name"><Input value={form.payout_bank_name} onChange={e => setForm(f => ({ ...f, payout_bank_name: e.target.value }))} /></Field>
          <Field label="Account Name"><Input value={form.payout_account_name} onChange={e => setForm(f => ({ ...f, payout_account_name: e.target.value }))} /></Field>
          <Field label="Delivery Company"><Input value={form.delivery_company} onChange={e => setForm(f => ({ ...f, delivery_company: e.target.value }))} placeholder="J&T, DHL, etc." /></Field>
          <Field label="Expected Ship Date"><Input type="date" value={form.expected_shipping_date} onChange={e => setForm(f => ({ ...f, expected_shipping_date: e.target.value }))} /></Field>
        </div>
      </div>

      <div className="rounded-xl border border-[rgba(47,106,82,0.2)] bg-[rgba(47,106,82,0.05)] p-4 text-sm text-[var(--ink-soft)] space-y-1">
        <p className="font-semibold text-[var(--ink)]">Before you accept, understand:</p>
        <p>• By accepting, you commit to pack and ship this product.</p>
        <p>• If you ship a wrong or fake product, BothSafe may refund the buyer.</p>
        <p>• You must upload a shipping proof after sending.</p>
      </div>

      <label className="flex items-center gap-3 cursor-pointer">
        <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)} className="h-4 w-4 rounded accent-[var(--brand)]" />
        <span className="text-sm text-[var(--ink)]">I understand and commit to ship this order</span>
      </label>

      <div className="flex gap-3">
        <Button onClick={() => onAccept(form)} disabled={!agreed || pending} className="flex-1 bg-[var(--brand)] text-white hover:bg-[var(--brand-strong)]">
          Accept &amp; Commit to Ship
        </Button>
        <Button onClick={onReject} disabled={pending} variant="ghost" className="flex-1 border-[var(--danger)] text-[var(--danger)] hover:bg-[rgba(180,67,52,0.05)]">
          <XCircle className="mr-2 h-4 w-4" />
          Reject Deal
        </Button>
      </div>
    </div>
  );
}
