import type { WalletCurrency } from "@/lib/api";

const USD_MINOR = BigInt(100);
const ZERO = BigInt(0);

export function formatMinor(minor: string | bigint, currency: WalletCurrency): string {
  const value = typeof minor === "string" ? BigInt(minor) : minor;
  if (currency === "USD") {
    const negative = value < ZERO;
    const abs = negative ? -value : value;
    const dollars = abs / USD_MINOR;
    const cents = abs % USD_MINOR;
    const sign = negative ? "-" : "";
    return `${sign}$${dollars.toString()}.${cents.toString().padStart(2, "0")}`;
  }
  return `៛${value.toLocaleString("en-US")}`;
}

export function parseMajorToMinor(major: string, currency: WalletCurrency): number {
  if (currency === "USD") {
    return Math.round(Number(major) * 100);
  }
  return Math.round(Number(major));
}
