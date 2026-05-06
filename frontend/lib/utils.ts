import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(
  amount: number | null | undefined,
  currency = "USD",
  locale = "en",
) {
  if (amount === null || amount === undefined || Number.isNaN(amount)) {
    return "--";
  }

  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

export function formatDateTime(
  value: string | number | Date | null | undefined,
  locale = "en",
) {
  if (!value) return "--";

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "--";

  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function resolveFileUrl(url: string | null | undefined) {
  if (!url) return null;
  if (/^https?:\/\//.test(url)) return url;

  const base = getApiOrigin();
  return `${base}${url.startsWith("/") ? url : `/${url}`}`;
}

export function getApiBaseUrl() {
  const raw =
    process.env.NEXT_PUBLIC_API_BASE_URL ??
    process.env.API_URL ??
    "http://localhost:3001/v1";
  return raw.endsWith("/v1")
    ? raw.replace(/\/$/, "")
    : `${raw.replace(/\/$/, "")}/v1`;
}

export function getApiOrigin() {
  return getApiBaseUrl().replace(/\/v1$/, "");
}

export function buildQueryString(params: Record<string, string | undefined>) {
  const search = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value) {
      search.set(key, value);
    }
  });

  const query = search.toString();
  return query ? `?${query}` : "";
}

export function titleCase(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function randomId() {
  return crypto.randomUUID();
}
