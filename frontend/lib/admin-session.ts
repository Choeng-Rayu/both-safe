import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export const ADMIN_SESSION_COOKIE = "bothsafe-admin-session";

export async function getAdminToken() {
  const cookieStore = await cookies();
  return cookieStore.get(ADMIN_SESSION_COOKIE)?.value ?? null;
}

export async function requireAdminToken() {
  const token = await getAdminToken();
  if (!token) {
    redirect("/admin");
  }
  return token;
}
