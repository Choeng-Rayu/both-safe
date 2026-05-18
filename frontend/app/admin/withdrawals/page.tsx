import { PublicHeader } from "@/components/layout/public-header";
import { AdminWithdrawalsList } from "@/components/admin/admin-withdrawals-list";
import { requireAdminToken } from "@/lib/admin-session";

export const dynamic = "force-dynamic";

export default async function AdminWithdrawalsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const params = await searchParams;
  const token = await requireAdminToken();

  return (
    <div className="min-h-screen">
      <PublicHeader />
      <main className="container-shell space-y-6 py-8">
        <section className="space-y-3">
          <span className="eyebrow">Admin</span>
          <h1 className="text-3xl font-semibold text-[var(--ink)]">Withdrawals</h1>
          <p className="text-sm text-[var(--muted)]">
            Review withdrawal requests, pay manually via external rails, and mark complete.
          </p>
        </section>
        <AdminWithdrawalsList adminToken={token} initialStatus={params.status} />
      </main>
    </div>
  );
}
