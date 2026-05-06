import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3003/v1";
const BACKEND_BASE = API_BASE.replace("/v1", "");
const SESSION_COOKIE = "bothsafe_session";

/**
 * POST /api/auth/logout
 * Proxies to backend /v1/auth/logout, clears the session cookie.
 */
export async function POST(request: NextRequest) {
  const sessionToken = request.cookies.get(SESSION_COOKIE)?.value;

  if (sessionToken) {
    // Tell backend to invalidate the session
    await fetch(`${BACKEND_BASE}/v1/auth/logout`, {
      method: "POST",
      headers: {
        Cookie: `${SESSION_COOKIE}=${sessionToken}`,
      },
    }).catch(() => {}); // best-effort
  }

  const res = NextResponse.json({ success: true });
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
