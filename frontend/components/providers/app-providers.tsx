"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  getMessages,
  resolveLocale,
  type Locale,
} from "@/lib/i18n";

// ─── i18n Context ─────────────────────────────────────────────────────────────

type I18nContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

function detectBrowserLocale() {
  if (typeof navigator === "undefined") return DEFAULT_LOCALE;
  const [first] = navigator.languages;
  return resolveLocale(first?.slice(0, 2));
}

// ─── Auth Context ─────────────────────────────────────────────────────────────

export interface SessionUser {
  id: string;
  email: string | null;
  name: string | null;
  avatarUrl: string | null;
  emailVerified: boolean;
}

type AuthContextValue = {
  user: SessionUser | null;
  isLoading: boolean;
  setUser: (user: SessionUser | null) => void;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

// ─── Providers ────────────────────────────────────────────────────────────────

export function AppProviders({
  children,
  initialLocale,
  initialUser,
}: {
  children: ReactNode;
  initialLocale: Locale;
  initialUser?: SessionUser | null;
}) {
  // ─── i18n ────────────────────────────────────────────────────────────────
  const [locale, setLocaleState] = useState<Locale>(() => {
    if (typeof window === "undefined") return initialLocale;
    const stored = window.localStorage.getItem(LOCALE_COOKIE);
    return stored ? resolveLocale(stored) : detectBrowserLocale();
  });

  const setLocale = useCallback((nextLocale: Locale) => {
    setLocaleState(nextLocale);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(LOCALE_COOKIE, nextLocale);
      document.cookie = `${LOCALE_COOKIE}=${nextLocale}; path=/; max-age=31536000; samesite=lax`;
      document.documentElement.lang = nextLocale;
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const dictionary = useMemo(() => getMessages(locale), [locale]);

  const i18nValue = useMemo<I18nContextValue>(
    () => ({
      locale,
      setLocale,
      t: (key) => dictionary[key] ?? getMessages(DEFAULT_LOCALE)[key] ?? key,
    }),
    [dictionary, locale, setLocale],
  );

  // ─── Auth ─────────────────────────────────────────────────────────────────
  const [user, setUser] = useState<SessionUser | null>(initialUser ?? null);
  const [isLoading, setIsLoading] = useState(false);

  const logout = useCallback(async () => {
    setIsLoading(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      setUser(null);
      window.location.href = "/";
    } finally {
      setIsLoading(false);
    }
  }, []);

  const authValue = useMemo<AuthContextValue>(
    () => ({ user, isLoading, setUser, logout }),
    [user, isLoading, setUser, logout],
  );

  return (
    <I18nContext.Provider value={i18nValue}>
      <AuthContext.Provider value={authValue}>
        {children}
      </AuthContext.Provider>
    </I18nContext.Provider>
  );
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used within AppProviders");
  }
  return context;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AppProviders");
  }
  return context;
}
