import { PublicHeader } from "@/components/layout/public-header";
import { AdminNav } from "@/components/admin/admin-nav";
import { AdminUsersList } from "@/components/admin/admin-users-list";
import { adminListUsers } from "@/lib/api";
import { requireAdmin, getSessionCookieHeader } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{
    search?: string;
    role?: "USER" | "ADMIN" | "all";
    status?: "all" | "active" | "disabled";
    page?: string;
  }>;
}) {
  const params = await searchParams;
  await requireAdmin("/admin/users");
  const cookieHeader = await getSessionCookieHeader();

  const data = await adminListUsers({
    search: params.search,
    role: params.role,
    status: params.status,
    page: params.page,
    pageSize: "25",
    cookieHeader,
  });

  return (
    <div className="min-h-screen">
      <PublicHeader />
      <main className="container-shell space-y-6 py-8">
        <AdminNav />
        <section className="space-y-3">
          <span className="eyebrow">Admin</span>
          <h1 className="text-3xl font-semibold text-[var(--ink)]">
            User management
          </h1>
          <p className="text-sm text-[var(--ink-soft)]">
            View user profiles, inspect wallet balances, and disable accounts
            that violate platform rules.
          </p>
        </section>
        <AdminUsersList
          initial={data}
          initialFilters={{
            search: params.search ?? "",
            role: params.role ?? "all",
            status: params.status ?? "all",
          }}
        />
      </main>
    </div>
  );
}
