import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const SESSION_COOKIE = "bothsafe_session";

// Routes that require authentication. Wallet-enabled deals require every
// participant to be registered, so deal pages (/d/*) are gated too.
const PROTECTED_ROUTES = ["/deals/new", "/dashboard", "/wallet", "/d/"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isProtected = PROTECTED_ROUTES.some((route) =>
    pathname.startsWith(route),
  );

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
    "/deals/new",
    "/deals/new/:path*",
    "/dashboard",
    "/dashboard/:path*",
    "/wallet",
    "/wallet/:path*",
    "/d/:path*",
  ],
};
