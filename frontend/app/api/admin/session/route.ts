import { NextResponse } from "next/server";
import { adminLogin } from "@/lib/api";
import { ADMIN_SESSION_COOKIE } from "@/lib/admin-session";

export async function POST(request: Request) {
  const body = (await request.json()) as { email: string; password: string };

  try {
    const result = await adminLogin(body);
    const response = NextResponse.json({ ok: true, admin: result.admin });
    response.cookies.set(ADMIN_SESSION_COOKIE, result.token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 8,
    });
    return response;
  } catch {
    return NextResponse.json(
      { error: "Invalid admin credentials." },
      { status: 401 },
    );
  }
}
