"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { AdminDealDetail } from "@/types/api";

export function AdminActionPanel({ deal }: { deal: AdminDealDetail }) {
  const router = useRouter();
  const latestPayment = deal.payments.at(-1);
  const [rejectReason, setRejectReason] = useState("");
  const [releaseReference, setReleaseReference] = useState("");
  const [refundReference, setRefundReference] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function send(path: string, payload?: Record<string, string>) {
    setPending(true);
    setMessage(null);
    try {
      const response = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload ? JSON.stringify(payload) : undefined,
      });
      const data = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;
      setMessage(response.ok ? "Done." : data?.error ?? "Action failed.");
      if (response.ok) {
        router.refresh();
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-4">
      {latestPayment?.adminStatus === "pending" ? (
        <div className="space-y-3 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-4">
          <Button
            className="w-full"
            disabled={pending}
            onClick={() =>
              void send(`/api/admin/payment-proofs/${latestPayment.id}/verify`)
            }
          >
            Verify payment
          </Button>
          <Field label="Reason for rejection">
            <Input
              value={rejectReason}
              onChange={(event) => setRejectReason(event.target.value)}
            />
          </Field>
          <Button
            variant="danger"
            className="w-full"
            disabled={pending || !rejectReason.trim()}
            onClick={() =>
              void send(`/api/admin/payment-proofs/${latestPayment.id}/reject`, {
                reason: rejectReason,
              })
            }
          >
            Reject payment
          </Button>
        </div>
      ) : null}

      <div className="space-y-3 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-4">
        <Field label="Payout reference">
          <Input
            value={releaseReference}
            onChange={(event) => setReleaseReference(event.target.value)}
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
          Mark payout released
        </Button>
      </div>

      <div className="space-y-3 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-4">
        <Field label="Refund reference">
          <Input
            value={refundReference}
            onChange={(event) => setRefundReference(event.target.value)}
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
          Mark refund completed
        </Button>
      </div>

      {message ? <p className="text-sm text-[var(--ink-soft)]">{message}</p> : null}
    </div>
  );
}
