"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/providers/app-providers";
import {
  adminApproveWithdrawal,
  adminCompleteWithdrawal,
  adminRejectWithdrawal,
  type WithdrawalAdminDetail,
} from "@/lib/api";
import { formatMinor } from "@/lib/wallet-format";

interface Props {
  adminToken: string;
  withdrawal: WithdrawalAdminDetail;
}

export function AdminWithdrawalDetail({ adminToken, withdrawal: initial }: Props) {
  const router = useRouter();
  const { t } = useI18n();
  const [withdrawal, setWithdrawal] = useState(initial);
  const [providerReference, setProviderReference] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isPending = withdrawal.status === "PENDING_REVIEW";
  const isApproved =
    withdrawal.status === "APPROVED" || withdrawal.status === "PROCESSING";
  const isTerminal = ["COMPLETED", "REJECTED", "CANCELLED", "FAILED"].includes(
    withdrawal.status,
  );

  const run = async (action: () => Promise<{ withdrawal: WithdrawalAdminDetail }>) => {
    setSubmitting(true);
    setError(null);
    try {
      const result = await action();
      setWithdrawal(result.withdrawal);
      router.refresh();
    } catch (err) {
      setError((err as Error).message ?? "Action failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface-strong)] p-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-[var(--muted)]">
              Withdrawal {withdrawal.public_id}
            </p>
            <p className="mt-1 text-2xl font-semibold">
              {formatMinor(withdrawal.amount_minor, withdrawal.currency)}
            </p>
            <p className="text-sm text-[var(--muted)]">
              {t(`withdrawal.status.${withdrawal.status}`)} ·{" "}
              {new Date(withdrawal.created_at).toLocaleString()}
            </p>
          </div>
          <div className="text-right text-sm text-[var(--muted)]">
            <p>
              <strong>User:</strong>{" "}
              {withdrawal.user?.email ?? withdrawal.user?.name ?? withdrawal.user_id}
            </p>
          </div>
        </header>

        {withdrawal.destination.khqr_image && (
          <div className="mt-6 rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] p-4">
            <p className="text-xs uppercase tracking-wide text-[var(--muted)]">
              Scan this QR to pay
            </p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={withdrawal.destination.khqr_image}
              alt="Withdrawal destination QR code"
              className="mt-2 h-64 w-64 rounded-lg border border-[var(--border)] bg-white object-contain p-2"
            />
            {withdrawal.destination.bank_name && (
              <p className="mt-2 text-sm">
                <span className="text-[var(--muted)]">Provider hint:</span>{" "}
                <strong>{withdrawal.destination.bank_name}</strong>
              </p>
            )}
          </div>
        )}

        <dl className="mt-6 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <Detail label="Destination type" value={withdrawal.destination.type} />
          {withdrawal.destination.khqr && (
            <Detail
              label="KHQR string"
              value={
                <code className="break-all font-mono text-xs">
                  {withdrawal.destination.khqr}
                </code>
              }
            />
          )}
          {!withdrawal.destination.khqr_image && withdrawal.destination.bank_name && (
            <Detail label="Bank" value={withdrawal.destination.bank_name} />
          )}
          {withdrawal.destination.account_name && (
            <Detail label="Account name" value={withdrawal.destination.account_name} />
          )}
          {withdrawal.destination.account_number && (
            <Detail
              label="Account number"
              value={withdrawal.destination.account_number}
            />
          )}
          {withdrawal.rejection_reason && (
            <Detail
              label="Rejection reason"
              value={<span className="text-red-700">{withdrawal.rejection_reason}</span>}
            />
          )}
          {withdrawal.provider_reference && (
            <Detail label="Payout reference" value={withdrawal.provider_reference} />
          )}
        </dl>
      </section>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {!isTerminal && (
        <section className="space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--surface-strong)] p-6">
          <h2 className="text-lg font-semibold">Actions</h2>

          {isPending && (
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() =>
                  run(() => adminApproveWithdrawal(withdrawal.id, adminToken))
                }
                disabled={submitting}
              >
                {t("admin.withdrawals.approve")}
              </Button>
            </div>
          )}

          {isApproved && (
            <div className="space-y-3 rounded-xl border border-[var(--border)] p-4">
              <p className="text-sm text-[var(--muted)]">
                {t("admin.withdrawals.mark_paid_hint")}
              </p>
              <input
                value={providerReference}
                onChange={(e) => setProviderReference(e.target.value)}
                placeholder={t("admin.withdrawals.provider_reference")}
                className="w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2"
              />
              <Button
                onClick={() =>
                  run(() =>
                    adminCompleteWithdrawal(
                      withdrawal.id,
                      { provider_reference: providerReference || undefined },
                      adminToken,
                    ),
                  )
                }
                disabled={submitting}
              >
                {t("admin.withdrawals.mark_paid")}
              </Button>
            </div>
          )}

          <div className="space-y-3 rounded-xl border border-[var(--border)] p-4">
            <p className="text-sm font-medium">{t("admin.withdrawals.reject")}</p>
            <input
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder={t("admin.withdrawals.reject_reason")}
              className="w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2"
            />
            <Button
              variant="secondary"
              onClick={() =>
                run(() =>
                  adminRejectWithdrawal(withdrawal.id, rejectionReason, adminToken),
                )
              }
              disabled={submitting || !rejectionReason}
            >
              {t("admin.withdrawals.reject")}
            </Button>
          </div>
        </section>
      )}

      {withdrawal.entries && withdrawal.entries.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Wallet ledger entries</h2>
          <ul className="divide-y divide-[var(--border)] rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] text-sm">
            {withdrawal.entries.map((entry) => (
              <li
                key={entry.id}
                className="flex items-center justify-between px-4 py-3"
              >
                <div>
                  <p className="font-medium">{entry.entry_type}</p>
                  <p className="text-xs text-[var(--muted)]">
                    {new Date(entry.created_at).toLocaleString()}
                  </p>
                </div>
                <p className="font-mono text-xs">
                  {entry.direction} {entry.amount_minor} → balance{" "}
                  {entry.balance_after_minor}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-[var(--muted)]">{label}</dt>
      <dd className="mt-1 text-[var(--ink)]">{value}</dd>
    </div>
  );
}
