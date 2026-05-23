"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CheckCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { AdminDealDetail } from "@/types/api";
import { formatCurrency } from "@/lib/utils";

export function AdminActionPanel({ deal }: { deal: AdminDealDetail }) {
  const router = useRouter();
  const latestPayment = deal.payments.at(-1);

  const [rejectReason, setRejectReason] = useState("");
  const [releaseReference, setReleaseReference] = useState("");
  const [refundReference, setRefundReference] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

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

  const netAmount = deal.netSellerAmount ?? deal.amount;
  const productTitle = deal.product?.title ?? "—";

  return (
    <div className="space-y-5">

      {/* ── 1. Payment verification ─────────────────────────── */}
      {latestPayment?.adminStatus === "pending" && (
        <div className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-4">
          <h3 className="text-sm font-semibold text-[var(--ink)]">💳 Verify Buyer Payment</h3>
          <p className="text-xs text-[var(--ink-soft)]">
            Check that the buyer has actually paid BothSafe&apos;s escrow account before verifying.
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

      {/* ── 2. Release escrow → seller wallet ───────────────── */}
      <div className="rounded-xl border-2 border-[rgba(47,106,82,0.3)] bg-[rgba(47,106,82,0.04)] p-4 space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-[var(--ink)]">💸 Release — Credit Seller Wallet</h3>
          <p className="text-xs text-[var(--ink-soft)] mt-1">
            Releasing escrow credits the net amount to the seller&apos;s BothSafe wallet. The seller withdraws separately via the wallet flow.
          </p>
        </div>

        <div className="rounded-lg bg-[rgba(47,106,82,0.1)] p-3 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[var(--ink-soft)]">Amount to credit</span>
            <span className="text-lg font-bold text-[var(--brand)]">
              {formatCurrency(netAmount, deal.currency)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-[var(--ink-soft)]">Product</span>
            <span className="text-xs font-medium text-[var(--ink)]">{productTitle}</span>
          </div>
        </div>

        <div className="space-y-3 pt-2 border-t border-[var(--border)]">
          <Field label="Internal reference (optional)">
            <Input
              value={releaseReference}
              onChange={(e) => setReleaseReference(e.target.value)}
              placeholder="e.g. ops-ticket-123"
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
            ✅ Release to Seller Wallet
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
