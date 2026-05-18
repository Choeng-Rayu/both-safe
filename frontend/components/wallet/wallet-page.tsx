"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { PublicHeader } from "@/components/layout/public-header";
import { Button } from "@/components/ui/button";
import {
  getWallet,
  getWalletLedger,
  listMyWithdrawals,
  cancelWithdrawal,
  type WalletCurrency,
  type WalletLedgerEntry,
  type WalletSnapshot,
  type WithdrawalSummary,
} from "@/lib/api";
import { formatMinor } from "@/lib/wallet-format";
import { useI18n, type SessionUser } from "@/components/providers/app-providers";

interface WalletPageProps {
  user: SessionUser;
}

export function WalletPage({ user }: WalletPageProps) {
  const { t } = useI18n();
  const [wallet, setWallet] = useState<WalletSnapshot | null>(null);
  const [entries, setEntries] = useState<WalletLedgerEntry[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [w, l, ws] = await Promise.all([
        getWallet(),
        getWalletLedger({ limit: 30 }),
        listMyWithdrawals(),
      ]);
      setWallet(w.wallet);
      setEntries(l.entries);
      setWithdrawals(ws.withdrawals);
    } catch (err) {
      setError((err as Error).message ?? "Failed to load wallet");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleCancel = useCallback(
    async (id: string) => {
      try {
        await cancelWithdrawal(id);
        await refresh();
      } catch (err) {
        setError((err as Error).message ?? "Failed to cancel withdrawal");
      }
    },
    [refresh],
  );

  return (
    <div className="min-h-screen bg-[var(--surface-soft)]">
      <PublicHeader />
      <main className="mx-auto max-w-5xl space-y-8 px-4 py-10">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-[var(--ink)]">{t("wallet.title")}</h1>
            <p className="mt-1 text-sm text-[var(--muted)]">
              {t("wallet.subtitle")} — {user.email ?? user.name ?? ""}
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={refresh} variant="secondary">
              {t("wallet.refresh")}
            </Button>
            <Link href="/wallet/withdraw">
              <Button>{t("wallet.withdraw")}</Button>
            </Link>
          </div>
        </header>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <BalanceCard label={t("wallet.balance_usd")} hint={t("wallet.available_now")} currency="USD" wallet={wallet} />
          <BalanceCard label={t("wallet.balance_khr")} hint={t("wallet.available_now")} currency="KHR" wallet={wallet} />
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-[var(--ink)]">{t("wallet.pending_section")}</h2>
          {loading && withdrawals.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">{t("common.loading")}...</p>
          ) : withdrawals.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">{t("wallet.no_withdrawals")}</p>
          ) : (
            <ul className="space-y-3">
              {withdrawals.map((w) => (
                <li
                  key={w.id}
                  className="rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] px-4 py-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-[var(--ink)]">
                        {formatMinor(w.amount_minor, w.currency)} —{" "}
                        <span className="text-sm text-[var(--muted)]">{w.public_id}</span>
                      </p>
                      <p className="text-xs text-[var(--muted)]">
                        {t(`withdrawal.status.${w.status}`)} · {new Date(w.created_at).toLocaleString()}
                      </p>
                      {w.rejection_reason && (
                        <p className="mt-1 text-xs text-red-600">
                          {t("withdrawal.status.REJECTED")}: {w.rejection_reason}
                        </p>
                      )}
                    </div>
                    {w.status === "PENDING_REVIEW" && (
                      <Button variant="ghost" onClick={() => handleCancel(w.id)}>
                        {t("common.cancel")}
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-[var(--ink)]">{t("wallet.activity_section")}</h2>
          {loading && entries.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">{t("common.loading")}...</p>
          ) : entries.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">{t("wallet.no_activity")}</p>
          ) : (
            <ul className="divide-y divide-[var(--border)] rounded-xl border border-[var(--border)] bg-[var(--surface-strong)]">
              {entries.map((e) => (
                <li key={e.id} className="flex items-center justify-between px-4 py-3 text-sm">
                  <div>
                    <p className="font-medium text-[var(--ink)]">{e.entry_type}</p>
                    <p className="text-xs text-[var(--muted)]">
                      {new Date(e.created_at).toLocaleString()}
                      {e.description ? ` · ${e.description}` : ""}
                    </p>
                  </div>
                  <p
                    className={
                      e.direction === "credit"
                        ? "font-semibold text-green-700"
                        : e.direction === "debit"
                          ? "font-semibold text-red-700"
                          : "font-medium text-[var(--muted)]"
                    }
                  >
                    {e.direction === "debit" ? "-" : e.direction === "credit" ? "+" : ""}
                    {formatMinor(e.amount_minor, e.currency)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}

function BalanceCard({
  label,
  hint,
  currency,
  wallet,
}: {
  label: string;
  hint: string;
  currency: WalletCurrency;
  wallet: WalletSnapshot | null;
}) {
  const available =
    wallet?.[currency === "USD" ? "available_usd_minor" : "available_khr_minor"] ?? "0";
  const effective =
    wallet?.[currency === "USD" ? "effective_usd_minor" : "effective_khr_minor"] ?? "0";
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-strong)] p-5">
      <p className="text-sm text-[var(--muted)]">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-[var(--ink)]">
        {formatMinor(available, currency)}
      </p>
      <p className="mt-1 text-xs text-[var(--muted)]">
        {hint}: {formatMinor(effective, currency)}
      </p>
    </div>
  );
}
