"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CheckCircle, AlertCircle, Copy, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { AdminDealDetail } from "@/types/api";
import { formatCurrency } from "@/lib/utils";

export function AdminActionPanel({ deal }: { deal: AdminDealDetail }) {
  const router = useRouter();
  const latestPayment = deal.payments.at(-1);
  const seller = deal.participants.find((p) => p.role === "seller");

  const [rejectReason, setRejectReason] = useState("");
  const [releaseReference, setReleaseReference] = useState("");
  const [refundReference, setRefundReference] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [copied, setCopied] = useState(false);

  async function send(path: string, payload?: Record<string, string>) {
    setPending(true);
    setMessage(null);
    try {
      const response = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload ? JSON.stringify(payload) : undefined,
      });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      setMessage({
        text: response.ok ? "✅ Done." : (data?.error ?? "Action failed."),
        ok: response.ok,
      });
      if (response.ok) router.refresh();
    } finally {
      setPending(false);
    }
  }

  function copyText(text: string) {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const sellerKhqrImage = seller?.payoutKhqrImage;
  const sellerKhqrId = seller?.payoutKhqr;
  const sellerHasBank = !!(seller?.payoutBankName || seller?.payoutAccountNumber);
  const netAmount = deal.netSellerAmount ?? deal.amount;
  const productTitle = deal.product?.title ?? "—";
  const memo = `BothSafe ${deal.publicId} – ${productTitle}`;

  return (
    <div className="space-y-5">

      {/* ── 1. Payment verification ─────────────────────────── */}
      {latestPayment?.adminStatus === "pending" && (
        <div className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-4">
          <h3 className="text-sm font-semibold text-[var(--ink)]">💳 Verify Buyer Payment</h3>
          <p className="text-xs text-[var(--ink-soft)]">
            Check that the buyer has actually paid BothSafe's escrow account before verifying.
          </p>
          <Button
            className="w-full"
            disabled={pending}
            onClick={() => void send(`/api/admin/payment-proofs/${latestPayment.id}/verify`)}
          >
            ✅ Verify Payment
          </Button>
          <Field label="Reason for rejection">
            <Input
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Wrong amount, fake proof..."
            />
          </Field>
          <Button
            variant="danger"
            className="w-full"
            disabled={pending || !rejectReason.trim()}
            onClick={() => void send(`/api/admin/payment-proofs/${latestPayment.id}/reject`, { reason: rejectReason })}
          >
            ❌ Reject Payment
          </Button>
        </div>
      )}

      {/* ── 2. Pay seller — KHQR release section ─────────────── */}
      <div className="rounded-xl border-2 border-[rgba(47,106,82,0.3)] bg-[rgba(47,106,82,0.04)] p-4 space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-[var(--ink)]">💸 Release — Pay Seller</h3>
          <p className="text-xs text-[var(--ink-soft)] mt-1">
            Open your Bakong app, scan the seller&apos;s KHQR below, enter the amount, and use the deal ID as memo.
          </p>
        </div>

        {/* Amount + product reference */}
        <div className="rounded-lg bg-[rgba(47,106,82,0.1)] p-3 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[var(--ink-soft)]">Amount to send</span>
            <span className="text-lg font-bold text-[var(--brand)]">
              {formatCurrency(netAmount, deal.currency)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-[var(--ink-soft)]">Product</span>
            <span className="text-xs font-medium text-[var(--ink)]">{productTitle}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-[var(--ink-soft)]">Memo / Reference</span>
            <button
              className="flex items-center gap-1 text-xs font-mono text-[var(--brand)] hover:underline"
              onClick={() => copyText(memo)}
            >
              {copied ? <CheckCircle className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              {deal.publicId}
            </button>
          </div>
        </div>

        {/* Seller's KHQR image (uploaded) */}
        {sellerKhqrImage && sellerKhqrImage !== "pending_upload" ? (
          <div className="space-y-2">
            <p className="text-xs font-medium text-[var(--ink)]">📱 Seller&apos;s KHQR — scan this in your Bakong app:</p>
            <div className="flex justify-center rounded-xl border border-[var(--border)] bg-white p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={sellerKhqrImage}
                alt="Seller KHQR code"
                className="max-w-[240px] w-full object-contain"
              />
            </div>
            <a
              href={sellerKhqrImage}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-[var(--brand)] hover:underline"
            >
              <ExternalLink className="h-3 w-3" />
              Open full size
            </a>
          </div>
        ) : sellerKhqrId ? (
          <div className="rounded-lg bg-[var(--surface-muted)] border border-[var(--border)] p-3 space-y-1">
            <p className="text-xs text-[var(--ink-soft)]">📱 Seller Bakong ID</p>
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-mono font-semibold text-[var(--ink)]">{sellerKhqrId}</span>
              <button
                onClick={() => copyText(sellerKhqrId)}
                className="text-xs text-[var(--brand)] hover:underline flex items-center gap-1"
              >
                <Copy className="h-3 w-3" />
                Copy
              </button>
            </div>
          </div>
        ) : sellerHasBank ? (
          <div className="rounded-lg bg-[var(--surface-muted)] border border-[var(--border)] p-3 space-y-2">
            <p className="text-xs text-[var(--ink-soft)]">🏦 Seller Bank Transfer</p>
            {seller?.payoutBankName && (
              <div className="text-sm font-medium text-[var(--ink)]">{seller.payoutBankName}</div>
            )}
            {seller?.payoutAccountName && (
              <div className="text-sm text-[var(--ink-soft)]">{seller.payoutAccountName}</div>
            )}
            {seller?.payoutAccountNumber && (
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-mono">{seller.payoutAccountNumber}</span>
                <button
                  onClick={() => copyText(seller.payoutAccountNumber!)}
                  className="text-xs text-[var(--brand)] hover:underline flex items-center gap-1"
                >
                  <Copy className="h-3 w-3" />
                  Copy
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-lg bg-orange-50 border border-orange-200 p-3">
            <p className="text-xs text-orange-700 font-medium">
              ⚠️ Seller has not provided payout information yet.
            </p>
            <p className="text-xs text-orange-600 mt-1">
              Contact seller to update their KHQR or bank account before releasing funds.
            </p>
          </div>
        )}

        {/* After paying — enter reference and mark released */}
        <div className="space-y-3 pt-2 border-t border-[var(--border)]">
          <p className="text-xs font-medium text-[var(--ink)]">
            After sending payment, enter the Bakong transaction reference:
          </p>
          <Field label="Payout reference / TX ID">
            <Input
              value={releaseReference}
              onChange={(e) => setReleaseReference(e.target.value)}
              placeholder="e.g. BK2026050700123"
            />
          </Field>
          <Button
            className="w-full"
            disabled={pending || !releaseReference.trim()}
            onClick={() =>
              void send(`/api/admin/deals/${deal.id}/release`, {
                payout_reference: releaseReference,
              })
            }
          >
            ✅ Mark Payout Released
          </Button>
        </div>
      </div>

      {/* ── 3. Refund buyer ─────────────────────────────────── */}
      <div className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-4">
        <h3 className="text-sm font-semibold text-[var(--ink)]">↩️ Refund Buyer</h3>
        <p className="text-xs text-[var(--ink-soft)]">
          Send money back to buyer&apos;s account, then mark refund completed.
        </p>
        <Field label="Refund reference">
          <Input
            value={refundReference}
            onChange={(e) => setRefundReference(e.target.value)}
            placeholder="Refund TX reference"
          />
        </Field>
        <Button
          variant="secondary"
          className="w-full"
          disabled={pending || !refundReference.trim()}
          onClick={() =>
            void send(`/api/admin/deals/${deal.id}/refund`, {
              refund_reference: refundReference,
            })
          }
        >
          Mark Refund Completed
        </Button>
      </div>

      {/* Status message */}
      {message && (
        <div
          className={`flex items-center gap-2 rounded-lg p-3 text-sm ${
            message.ok
              ? "bg-[rgba(47,106,82,0.08)] text-[var(--brand)]"
              : "bg-[rgba(180,67,52,0.08)] text-[var(--danger)]"
          }`}
        >
          {message.ok ? (
            <CheckCircle className="h-4 w-4 shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0" />
          )}
          {message.text}
        </div>
      )}
    </div>
  );
}
