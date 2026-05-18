"use client";

import { useEffect, useState } from "react";
import { Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/providers/app-providers";
import {
  getWallet,
  payDealFromWallet,
  type WalletCurrency,
  type WalletSnapshot,
} from "@/lib/api";
import { formatMinor, parseMajorToMinor } from "@/lib/wallet-format";

interface PayWithWalletProps {
  publicId: string;
  currency: WalletCurrency;
  amount: number;
  onPaid?: () => void;
}

export function PayWithWallet({ publicId, currency, amount, onPaid }: PayWithWalletProps) {
  const { t } = useI18n();
  const [wallet, setWallet] = useState<WalletSnapshot | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const result = await getWallet();
        if (!cancelled) {
          setWallet(result.wallet);
        }
      } catch (err) {
        if (cancelled) return;
        // 401 → user not logged in; render nothing. Other errors → surface.
        const status = (err as { status?: number })?.status;
        if (status !== 401) {
          setLoadError((err as Error).message ?? "Failed to load wallet");
        }
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!loaded) return null;
  if (!wallet) {
    if (loadError) {
      return (
        <p className="text-xs text-amber-700" role="alert">
          {loadError}
        </p>
      );
    }
    return null;
  }

  const amountMinor = parseMajorToMinor(String(amount), currency);
  const effectiveMinor = BigInt(
    wallet[currency === "USD" ? "effective_usd_minor" : "effective_khr_minor"],
  );
  const hasEnough = effectiveMinor >= BigInt(amountMinor);

  const handleClick = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await payDealFromWallet(publicId);
      onPaid?.();
    } catch (err) {
      setError((err as Error).message ?? "Payment from wallet failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-strong)] p-4">
      <div className="flex items-start gap-3">
        <Wallet className="mt-0.5 h-5 w-5 text-[var(--brand)]" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-[var(--ink)]">
            {t("wallet.pay_with_wallet")}
          </p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            {formatMinor(effectiveMinor, currency)} · {formatMinor(BigInt(amountMinor), currency)}
          </p>
          {!hasEnough && (
            <p className="mt-2 text-xs text-amber-700">
              {t("wallet.insufficient_funds")}
            </p>
          )}
          {error && (
            <p className="mt-2 text-xs text-red-700" role="alert">
              {error}
            </p>
          )}
        </div>
        <Button
          onClick={handleClick}
          disabled={!hasEnough || submitting}
          className="shrink-0"
        >
          {submitting ? t("wallet.paying") : t("wallet.pay_now")}
        </Button>
      </div>
    </div>
  );
}
