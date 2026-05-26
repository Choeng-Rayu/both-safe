import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const SESSION_COOKIE = "bothsafe_session";
const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3003/v1";

export type UserRole = "USER" | "ADMIN";

export interface SessionUser {
  id: string;
  email: string | null;
  name: string | null;
  avatarUrl: string | null;
  emailVerified: boolean;
  role: UserRole;
  disabled: boolean;
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
 * Server-side: require an admin user. Logged-in non-admins are redirected
 * to the regular dashboard. Anonymous users are redirected to /login.
 *
 * The whole admin section uses this — the platform now has a single
 * login form and admins are differentiated by `User.role === 'ADMIN'`.
 */
export async function requireAdmin(redirectTo?: string): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) {
    const params = redirectTo ? `?redirectTo=${encodeURIComponent(redirectTo)}` : "";
    redirect(`/login${params}`);
  }
  if (user.role !== "ADMIN") {
    redirect("/dashboard");
  }
  return user;
}

/**
 * Server-side helper: read the session cookie and build a `Cookie`
 * header to forward to the backend on behalf of the user. Used by
 * server components that proxy admin API calls.
 */
export async function getSessionCookieHeader(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  return token ? `${SESSION_COOKIE}=${token}` : null;
}
