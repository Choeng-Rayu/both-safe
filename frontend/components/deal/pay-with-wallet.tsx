"use client";

import { useEffect, useState } from "react";
import { Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  const [wallet, setWallet] = useState<WalletSnapshot | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const result = await getWallet();
        setWallet(result.wallet);
      } catch {
        // User may not be logged in; component renders nothing in that case.
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  if (!loaded || !wallet) {
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
          <p className="text-sm font-semibold text-[var(--ink)]">Pay with BothSafe Wallet</p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            Available: {formatMinor(effectiveMinor, currency)} · Charge:{" "}
            {formatMinor(BigInt(amountMinor), currency)}
          </p>
          {!hasEnough && (
            <p className="mt-2 text-xs text-amber-700">
              Not enough wallet balance for this deal. Pay with KHQR below or top up first.
            </p>
          )}
          {error && (
            <p className="mt-2 text-xs text-red-700">{error}</p>
          )}
        </div>
        <Button
          onClick={handleClick}
          disabled={!hasEnough || submitting}
          className="shrink-0"
        >
          {submitting ? "Paying..." : "Pay now"}
        </Button>
      </div>
    </div>
  );
}
