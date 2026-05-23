import { PublicHeader } from "@/components/layout/public-header";
import { AdminDealFilters } from "@/components/admin/admin-deal-filters";
import { AdminDealTable } from "@/components/admin/admin-deal-table";
import { AdminNav } from "@/components/admin/admin-nav";
import { adminGetDeals } from "@/lib/api";
import { requireAdmin, getSessionCookieHeader } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AdminDealsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const params = await searchParams;
  await requireAdmin("/admin/deals");
  const cookieHeader = await getSessionCookieHeader();
  const deals = await adminGetDeals({
    status: params.status,
    page: params.page,
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
            Deal operations
          </h1>
        </section>
        <AdminDealFilters action="/admin/deals" currentStatus={params.status} />
        <AdminDealTable deals={deals.items} />
      </main>
    </div>
  );
}
