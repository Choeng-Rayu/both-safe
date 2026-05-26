"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PublicHeader } from "@/components/layout/public-header";
import { Button } from "@/components/ui/button";
import { ImageUploadField } from "@/components/ui/image-upload-field";
import { useI18n } from "@/components/providers/app-providers";
import {
  ApiError,
  createWithdrawal,
  createWithdrawalWithQr,
  getWallet,
  type WalletCurrency,
  type WalletSnapshot,
} from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import { formatMinor, parseMajorToMinor } from "@/lib/wallet-format";

type Mode = "qr_upload" | "bank_account";

export function WithdrawForm() {
  const router = useRouter();
  const { t } = useI18n();

  const [wallet, setWallet] = useState<WalletSnapshot | null>(null);
  const [mode, setMode] = useState<Mode>("qr_upload");

  const [currency, setCurrency] = useState<WalletCurrency>("USD");
  const [amount, setAmount] = useState("");
  const [providerLabel, setProviderLabel] = useState("");
  const [qrFile, setQrFile] = useState<File | null>(null);

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

      if (mode === "qr_upload") {
        if (!qrFile) {
          throw new Error("Please upload a QR code image.");
        }
        await createWithdrawalWithQr({
          currency,
          amount_minor: amountMinor,
          provider_label: providerLabel || undefined,
          qr_image: qrFile,
        });
      } else {
        if (!bankName || !accountNumber) {
          throw new Error("Bank name and account number are required.");
        }
        await createWithdrawal({
          currency,
          amount_minor: amountMinor,
          destination: {
            type: "bank_account",
            bank_name: bankName,
            account_name: accountName,
            account_number: accountNumber,
          },
        });
      }

      router.push("/wallet");
      router.refresh();
    } catch (err) {
      // Surface the backend's domain-specific error key (e.g.
      // wallet.insufficient_funds) and decorate it with the actual
      // available-vs-requested numbers so the user knows exactly
      // what they're missing.
      let message = getErrorMessage(err, t);
      if (err instanceof ApiError) {
        const details = err.details as
          | { effective_available?: string; requested?: string; currency?: string }
          | undefined;
        if (
          err.messageKey === "wallet.insufficient_funds" &&
          details?.effective_available !== undefined &&
          details?.currency
        ) {
          const cur = details.currency as WalletCurrency;
          const have = formatMinor(details.effective_available, cur);
          const want = formatMinor(details.requested ?? "0", cur);
          message = `Not enough balance. You have ${have}, requested ${want}.`;
        }
      }
      setError(message);
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--surface-soft)]">
      <PublicHeader />
      <main className="mx-auto max-w-xl px-4 py-10">
        <h1 className="text-2xl font-semibold text-[var(--ink)]">{t("withdrawal.new_title")}</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">{t("withdrawal.new_subtitle")}</p>

        <form
          onSubmit={handleSubmit}
          className="mt-8 space-y-5 rounded-2xl border border-[var(--border)] bg-[var(--surface-strong)] p-6"
        >
          <div className="flex gap-1 rounded-lg border border-[var(--border)] p-1">
            <ModeTab
              active={mode === "qr_upload"}
              onClick={() => setMode("qr_upload")}
              label="QR code"
              hint="Bakong, Binance, AcleDA..."
            />
            <ModeTab
              active={mode === "bank_account"}
              onClick={() => setMode("bank_account")}
              label={t("withdrawal.destination.bank")}
              hint="Manual transfer"
            />
          </div>

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

          {mode === "qr_upload" ? (
            <>
              <Field label="QR code image">
                <ImageUploadField
                  inputId="qr-upload"
                  value={qrFile}
                  onChange={(file) => {
                    setError(null);
                    setQrFile(file);
                  }}
                  onValidationError={setError}
                  promptLabel="Tap to upload your QR code"
                  helperText="PNG / JPG / WebP, up to 10 MB"
                  previewAlt="QR preview"
                />
              </Field>

              <Field label="Provider (optional)">
                <input
                  value={providerLabel}
                  onChange={(e) => setProviderLabel(e.target.value)}
                  placeholder="Bakong, Binance, AcleDA..."
                  className="w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2"
                />
                <p className="mt-1 text-xs text-[var(--muted)]">
                  Tells the admin which wallet app to use when scanning your QR.
                </p>
              </Field>
            </>
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
            <div
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
            >
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

function ModeTab({
  active,
  onClick,
  label,
  hint,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  hint: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 rounded-md px-3 py-2 text-left text-sm transition ${
        active
          ? "bg-[var(--brand)] text-white shadow"
          : "text-[var(--ink-soft)] hover:text-[var(--ink)]"
      }`}
    >
      <span className="block font-medium">{label}</span>
      <span className={`block text-xs ${active ? "text-white/80" : "text-[var(--muted)]"}`}>
        {hint}
      </span>
    </button>
  );
}
