"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Upload, X } from "lucide-react";
import { PublicHeader } from "@/components/layout/public-header";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/providers/app-providers";
import {
  createWithdrawal,
  createWithdrawalWithQr,
  getWallet,
  type WalletCurrency,
  type WalletSnapshot,
} from "@/lib/api";
import { formatMinor, parseMajorToMinor } from "@/lib/wallet-format";

type Mode = "qr_upload" | "bank_account";

export function WithdrawForm() {
  const router = useRouter();
  const { t } = useI18n();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [wallet, setWallet] = useState<WalletSnapshot | null>(null);
  const [mode, setMode] = useState<Mode>("qr_upload");

  const [currency, setCurrency] = useState<WalletCurrency>("USD");
  const [amount, setAmount] = useState("");
  const [providerLabel, setProviderLabel] = useState("");
  const [qrFile, setQrFile] = useState<File | null>(null);
  const [qrPreview, setQrPreview] = useState<string | null>(null);

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

  useEffect(() => {
    if (!qrFile) {
      setQrPreview(null);
      return;
    }
    const url = URL.createObjectURL(qrFile);
    setQrPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [qrFile]);

  const effective =
    wallet?.[currency === "USD" ? "effective_usd_minor" : "effective_khr_minor"] ?? "0";

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file (PNG, JPG, WebP).");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("Image must be smaller than 10 MB.");
      return;
    }
    setError(null);
    setQrFile(file);
  };

  const clearFile = () => {
    setQrFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

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
                {qrPreview ? (
                  <div className="relative inline-block">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={qrPreview}
                      alt="QR preview"
                      className="h-44 w-44 rounded-lg border border-[var(--border)] object-contain bg-white"
                    />
                    <button
                      type="button"
                      onClick={clearFile}
                      className="absolute -top-2 -right-2 rounded-full bg-[var(--ink)] p-1 text-white shadow"
                      aria-label="Remove image"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <label
                    htmlFor="qr-upload"
                    className="flex h-44 w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-[var(--border)] bg-white px-4 py-6 text-sm text-[var(--muted)] transition hover:border-[var(--brand)] hover:text-[var(--ink)]"
                  >
                    <Upload className="h-6 w-6" />
                    <span>Tap to upload your QR code</span>
                    <span className="text-xs">PNG / JPG / WebP, up to 10 MB</span>
                  </label>
                )}
                <input
                  ref={fileInputRef}
                  id="qr-upload"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleFileChange}
                  className="sr-only"
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
