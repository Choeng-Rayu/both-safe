import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const SESSION_COOKIE = "bothsafe_session";
const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3003/v1";

export interface SessionUser {
  id: string;
  email: string | null;
  name: string | null;
  avatarUrl: string | null;
  emailVerified: boolean;
}

/**
 * Server-side: get current user from session cookie via backend /auth/me.
 * Returns null if not authenticated.
 */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  try {
    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: { Cookie: `${SESSION_COOKIE}=${token}` },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { user: SessionUser };
    return data.user;
  } catch {
    return null;
  }
}

/**
 * Server-side: require user. Redirects to /login if not authenticated.
 */
export async function requireUser(redirectTo?: string): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) {
    const params = redirectTo ? `?redirectTo=${encodeURIComponent(redirectTo)}` : "";
    redirect(`/login${params}`);
  }
  return user;
}

/**
 * Get the backend OAuth initiation URL.
 */
export function getOAuthUrl(
  provider: "telegram" | "google",
  redirectAfter = "/",
): string {
  const backendBase = API_BASE.replace("/v1", "");
  return `${backendBase}/v1/auth/${provider}/authorize?redirectAfter=${encodeURIComponent(redirectAfter)}`;
}
