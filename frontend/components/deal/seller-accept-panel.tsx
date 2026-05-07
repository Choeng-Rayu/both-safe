'use client';

import { useState } from 'react';
import { CheckCircle, XCircle, Building2, QrCode } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { ImageUploader } from '@/components/deal/image-uploader';
import { useI18n } from '@/components/providers/app-providers';
import { CAMBODIA_KHQR_BANKS } from '@/lib/cambodia-banks';

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
    payout_khqr_image?: string;
    expected_shipping_date?: string;
    delivery_company?: string;
  }) => void;
  onReject: () => void;
};

type PayoutMethod = 'bank' | 'khqr';

export function SellerAcceptPanel({ amount, currency, productTitle, buyerName, pending, onAccept, onReject }: Props) {
  const { locale } = useI18n();
  const [agreed, setAgreed] = useState(false);
  const [payoutMethod, setPayoutMethod] = useState<PayoutMethod>('bank');
  const [form, setForm] = useState({
    payout_khqr: '',
    payout_bank_name: '',
    payout_account_name: '',
    payout_account_number: '',
    expected_shipping_date: '',
    delivery_company: '',
  });
  const [khqrImage, setKhqrImage] = useState<File | null>(null);

  const fmt = (v: number | null) => v != null ? new Intl.NumberFormat(locale, { style: 'currency', currency: currency || 'USD' }).format(v) : '--';

  const hasPayoutInfo = payoutMethod === 'bank'
    ? (form.payout_bank_name && form.payout_account_number)
    : (khqrImage != null);

  function handleAccept() {
    if (payoutMethod === 'khqr' && khqrImage) {
      // For MVP, pass a placeholder — the image would be uploaded via the existing storage endpoint
      // In practice, the parent component or a dedicated upload handler would upload the file first
      const payload: Record<string, string | undefined> = {
        expected_shipping_date: form.expected_shipping_date || undefined,
        delivery_company: form.delivery_company || undefined,
        payout_khqr_image: 'pending_upload', // Flag that KHQR image is provided
      };
      onAccept(payload);
    } else {
      onAccept({
        ...form,
        payout_khqr: form.payout_khqr || undefined,
        payout_bank_name: form.payout_bank_name || undefined,
        payout_account_name: form.payout_account_name || undefined,
        payout_account_number: form.payout_account_number || undefined,
        expected_shipping_date: form.expected_shipping_date || undefined,
        delivery_company: form.delivery_company || undefined,
      });
    }
  }

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

      {/* Payout Method Selector */}
      <div className="space-y-4">
        <p className="text-sm font-semibold text-[var(--ink)]">How do you want to receive payment?</p>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setPayoutMethod('bank')}
            className={`flex items-center gap-3 rounded-xl border-2 p-4 text-left transition-all ${
              payoutMethod === 'bank'
                ? 'border-[var(--brand)] bg-[rgba(47,106,82,0.05)] shadow-sm'
                : 'border-[var(--border)] bg-transparent hover:border-[var(--ink-soft)]'
            }`}
          >
            <Building2 className={`h-5 w-5 ${payoutMethod === 'bank' ? 'text-[var(--brand)]' : 'text-[var(--ink-soft)]'}`} />
            <div>
              <p className={`text-sm font-semibold ${payoutMethod === 'bank' ? 'text-[var(--brand)]' : 'text-[var(--ink)]'}`}>Bank Account</p>
              <p className="text-xs text-[var(--ink-soft)]">Select your bank</p>
            </div>
          </button>
          <button
            type="button"
            onClick={() => setPayoutMethod('khqr')}
            className={`flex items-center gap-3 rounded-xl border-2 p-4 text-left transition-all ${
              payoutMethod === 'khqr'
                ? 'border-[var(--brand)] bg-[rgba(47,106,82,0.05)] shadow-sm'
                : 'border-[var(--border)] bg-transparent hover:border-[var(--ink-soft)]'
            }`}
          >
            <QrCode className={`h-5 w-5 ${payoutMethod === 'khqr' ? 'text-[var(--brand)]' : 'text-[var(--ink-soft)]'}`} />
            <div>
              <p className={`text-sm font-semibold ${payoutMethod === 'khqr' ? 'text-[var(--brand)]' : 'text-[var(--ink)]'}`}>KHQR Image</p>
              <p className="text-xs text-[var(--ink-soft)]">Upload your QR</p>
            </div>
          </button>
        </div>

        {payoutMethod === 'bank' ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Bank" required>
              <Select
                value={form.payout_bank_name}
                onChange={e => setForm(f => ({ ...f, payout_bank_name: e.target.value }))}
              >
                <option value="">Select a bank...</option>
                {CAMBODIA_KHQR_BANKS.map(bank => (
                  <option key={bank.code} value={bank.code}>{bank.name}</option>
                ))}
              </Select>
            </Field>
            <Field label="Account Name" required>
              <Input
                value={form.payout_account_name}
                onChange={e => setForm(f => ({ ...f, payout_account_name: e.target.value }))}
                placeholder="Your name on the account"
              />
            </Field>
            <Field label="Account Number" required>
              <Input
                value={form.payout_account_number}
                onChange={e => setForm(f => ({ ...f, payout_account_number: e.target.value }))}
                placeholder="e.g. 000 123 456"
              />
            </Field>
            <Field label="Bakong ID" hint="Optional">
              <Input
                value={form.payout_khqr}
                onChange={e => setForm(f => ({ ...f, payout_khqr: e.target.value }))}
                placeholder="yourname@aba"
              />
            </Field>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-[var(--ink-soft)]">Upload a screenshot of your KHQR code from your banking app.</p>
            <Field label="KHQR Image" required>
              <ImageUploader value={khqrImage} onChange={setKhqrImage} />
            </Field>
          </div>
        )}
      </div>

      {/* Shipping info */}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Delivery Company">
          <Input value={form.delivery_company} onChange={e => setForm(f => ({ ...f, delivery_company: e.target.value }))} placeholder="J&T, DHL, etc." />
        </Field>
        <Field label="Expected Ship Date">
          <Input type="date" value={form.expected_shipping_date} onChange={e => setForm(f => ({ ...f, expected_shipping_date: e.target.value }))} />
        </Field>
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
        <Button onClick={handleAccept} disabled={!agreed || !hasPayoutInfo || pending} className="flex-1 bg-[var(--brand)] text-white hover:bg-[var(--brand-strong)]">
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
