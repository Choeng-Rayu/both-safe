import { notFound } from "next/navigation";
import { PublicHeader } from "@/components/layout/public-header";
import { AdminNav } from "@/components/admin/admin-nav";
import { AdminWithdrawalDetail } from "@/components/admin/admin-withdrawal-detail";
import { adminGetWithdrawal, type WithdrawalAdminDetail } from "@/lib/api";
import { requireAdmin, getSessionCookieHeader } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AdminWithdrawalDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireAdmin(`/admin/withdrawals/${id}`);
  const cookieHeader = await getSessionCookieHeader();

  let withdrawal: WithdrawalAdminDetail;
  try {
    const result = await adminGetWithdrawal(id, cookieHeader);
    withdrawal = result.withdrawal;
  } catch {
    notFound();
  }

  return (
    <div className="min-h-screen">
      <PublicHeader />
      <main className="container-shell space-y-6 py-8">
        <AdminNav />
        <AdminWithdrawalDetail withdrawal={withdrawal} />
      </main>
    </div>
  );
}
