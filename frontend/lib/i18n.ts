import { LOCALES } from "@/lib/constants";
import { messages } from "@/messages";

export const LOCALE_COOKIE = "bothsafe-locale";
export const DEFAULT_LOCALE = "en";

export type Locale = (typeof LOCALES)[number];

export function isLocale(value: string | undefined | null): value is Locale {
  return !!value && LOCALES.includes(value as Locale);
}

export function resolveLocale(value: string | undefined | null): Locale {
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

export function getMessages(locale: Locale) {
  return messages[locale] ?? messages[DEFAULT_LOCALE];
}
