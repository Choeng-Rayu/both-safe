import { PublicHeader } from "@/components/layout/public-header";
import { AdminNav } from "@/components/admin/admin-nav";
import { AdminWithdrawalsList } from "@/components/admin/admin-withdrawals-list";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AdminWithdrawalsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const params = await searchParams;
  await requireAdmin("/admin/withdrawals");
  // Default to the actionable queue so the first thing the admin
  // sees is "what needs my approval right now".
  const initialStatus = params.status ?? "PENDING_REVIEW";

  return (
    <div className="min-h-screen">
      <PublicHeader />
      <main className="container-shell space-y-6 py-8">
        <AdminNav />
        <section className="space-y-3">
          <span className="eyebrow">Admin</span>
          <h1 className="text-3xl font-semibold text-[var(--ink)]">Withdrawals</h1>
          <p className="text-sm text-[var(--muted)]">
            Review withdrawal requests, pay manually via external rails, and
            mark complete. The user is notified automatically on approve,
            complete, or reject.
          </p>
        </section>
        <AdminWithdrawalsList initialStatus={initialStatus} />
      </main>
    </div>
  );
}
