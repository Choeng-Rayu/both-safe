import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const SESSION_COOKIE = "bothsafe_session";

// Strictly protected routes — never accessible without a session.
//
// `/deals/new` is intentionally *not* listed here. The create-deal
// page renders client-side and shows an inline auth modal when the
// user is anonymous (see CreateDealPage + AuthRequiredDialog). That
// gives a smoother popup-style UX instead of a hard redirect.
const PROTECTED_ROUTES = ["/dashboard", "/wallet"];

export function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  // Deal rooms are normally protected, but invite recipients arrive at
  // /d/<publicId>?invite=<token> before they have logged in. Allow that
  // first hop through so they can see the deal preview and authenticate
  // via the in-page login → join flow.
  const isDealRoom = pathname.startsWith("/d/");
  const hasInviteToken = searchParams.has("invite");
  const isProtectedDealRoom = isDealRoom && !hasInviteToken;

  const isProtected =
    PROTECTED_ROUTES.some((route) => pathname.startsWith(route)) ||
    isProtectedDealRoom;

  if (isProtected) {
    const sessionToken = request.cookies.get(SESSION_COOKIE)?.value;

    if (!sessionToken) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirectTo", pathname + request.nextUrl.search);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard",
    "/dashboard/:path*",
    "/wallet",
    "/wallet/:path*",
    "/d/:path*",
  ],
};
