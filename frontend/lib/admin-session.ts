import { requireAdmin } from "@/lib/auth";

/**
 * Backwards-compatible shim.
 *
 * The platform used to maintain a separate `bothsafe-admin-session`
 * cookie holding a JWT. That cookie is gone — admins now log in via
 * the same form as users and are recognised by `User.role === 'ADMIN'`.
 *
 * Server components that previously called `requireAdminToken()` should
 * call `requireAdmin()` directly. This shim is kept so any remaining
 * call sites continue to redirect appropriately. It returns the admin
 * user id so existing code that wants a "token" can still pass a
 * non-empty string downstream — cookie-based admin API calls do not
 * need a Bearer token any more.
 */
export async function requireAdminToken(): Promise<string> {
  const user = await requireAdmin();
  return user.id;
}

export async function getAdminToken(): Promise<string | null> {
  // Always null — preserved for compatibility with any unused imports.
  return null;
}
