import { notFound } from "next/navigation";
import { PublicHeader } from "@/components/layout/public-header";
import { AdminWithdrawalDetail } from "@/components/admin/admin-withdrawal-detail";
import { adminGetWithdrawal } from "@/lib/api";
import { requireAdminToken } from "@/lib/admin-session";

export const dynamic = "force-dynamic";

export default async function AdminWithdrawalDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const token = await requireAdminToken();
  try {
    const result = await adminGetWithdrawal(id, token);
    return (
      <div className="min-h-screen">
        <PublicHeader />
        <main className="container-shell space-y-6 py-8">
          <AdminWithdrawalDetail adminToken={token} withdrawal={result.withdrawal} />
        </main>
      </div>
    );
  } catch {
    notFound();
  }
}
