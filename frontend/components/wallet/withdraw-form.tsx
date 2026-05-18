"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PublicHeader } from "@/components/layout/public-header";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/providers/app-providers";
import {
  createWithdrawal,
  getWallet,
  type WalletCurrency,
  type WalletSnapshot,
} from "@/lib/api";
import { formatMinor, parseMajorToMinor } from "@/lib/wallet-format";

type DestinationType = "bakong_khqr" | "bank_account";

export function WithdrawForm() {
  const router = useRouter();
  const { t } = useI18n();
  const [wallet, setWallet] = useState<WalletSnapshot | null>(null);
  const [currency, setCurrency] = useState<WalletCurrency>("USD");
  const [amount, setAmount] = useState("");
  const [destinationType, setDestinationType] = useState<DestinationType>("bakong_khqr");
  const [khqr, setKhqr] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountName, setAccountName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const w = await getWallet();
        setWallet(w.wallet);
      } catch (err) {
        setError((err as Error).message ?? "Failed to load wallet");
      }
    })();
  }, []);

  const effective =
    wallet?.[currency === "USD" ? "effective_usd_minor" : "effective_khr_minor"] ?? "0";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const amountMinor = parseMajorToMinor(amount, currency);
      if (!Number.isFinite(amountMinor) || amountMinor <= 0) {
        throw new Error(t("withdrawal.amount_usd"));
      }
      const destination =
        destinationType === "bakong_khqr"
          ? { type: destinationType, khqr }
          : {
              type: destinationType,
              bank_name: bankName,
              account_name: accountName,
              account_number: accountNumber,
            };
      await createWithdrawal({
        currency,
        amount_minor: amountMinor,
        destination,
      });
      router.push("/wallet");
      router.refresh();
    } catch (err) {
      setError((err as Error).message ?? "Failed to submit withdrawal");
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--surface-soft)]">
      <PublicHeader />
      <main className="mx-auto max-w-xl px-4 py-10">
        <h1 className="text-2xl font-semibold text-[var(--ink)]">{t("withdrawal.new_title")}</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">{t("withdrawal.new_subtitle")}</p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-5 rounded-2xl border border-[var(--border)] bg-[var(--surface-strong)] p-6">
          <Field label={t("withdrawal.currency")}>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value as WalletCurrency)}
              className="w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2"
            >
              <option value="USD">USD</option>
              <option value="KHR">KHR</option>
            </select>
            <p className="mt-1 text-xs text-[var(--muted)]">
              {t("wallet.available_now")}: {formatMinor(effective, currency)}
            </p>
          </Field>

          <Field label={currency === "USD" ? t("withdrawal.amount_usd") : t("withdrawal.amount_khr")}>
            <input
              type="number"
              inputMode="decimal"
              step={currency === "USD" ? "0.01" : "1"}
              min={currency === "USD" ? "0.01" : "1"}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={currency === "USD" ? "12.50" : "50000"}
              className="w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2"
              required
            />
          </Field>

          <Field label={t("withdrawal.destination")}>
            <select
              value={destinationType}
              onChange={(e) => setDestinationType(e.target.value as DestinationType)}
              className="w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2"
            >
              <option value="bakong_khqr">{t("withdrawal.destination.bakong")}</option>
              <option value="bank_account">{t("withdrawal.destination.bank")}</option>
            </select>
          </Field>

          {destinationType === "bakong_khqr" ? (
            <Field label={t("withdrawal.khqr_string")}>
              <textarea
                value={khqr}
                onChange={(e) => setKhqr(e.target.value)}
                rows={3}
                className="w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 font-mono text-xs"
                placeholder="00020101..."
                required
              />
              <p className="mt-1 text-xs text-[var(--muted)]">{t("withdrawal.khqr_hint")}</p>
            </Field>
          ) : (
            <>
              <Field label={t("withdrawal.bank_name")}>
                <input
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  className="w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2"
                  required
                />
              </Field>
              <Field label={t("withdrawal.account_name")}>
                <input
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  className="w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2"
                />
              </Field>
              <Field label={t("withdrawal.account_number")}>
                <input
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  className="w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2"
                  required
                />
              </Field>
            </>
          )}

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="ghost"
              onClick={() => router.push("/wallet")}
            >
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? t("withdrawal.submitting") : t("withdrawal.submit")}
            </Button>
          </div>
        </form>
      </main>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-[var(--ink)]">{label}</span>
      {children}
    </label>
  );
}
