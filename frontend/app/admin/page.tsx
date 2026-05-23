import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

/**
 * `/admin` is no longer a separate login page — admins log in via the
 * shared `/login` form. This route just redirects:
 *   - admins → `/admin/users` (the new home page of the admin dashboard)
 *   - everyone else → `/login?redirectTo=/admin/users`
 */
export const dynamic = "force-dynamic";

export default async function AdminEntryPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login?redirectTo=%2Fadmin%2Fusers");
  }
  if (user.role !== "ADMIN") {
    redirect("/dashboard");
  }
  redirect("/admin/users");
}
