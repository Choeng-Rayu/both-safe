import { notFound } from "next/navigation";
import { PublicHeader } from "@/components/layout/public-header";
import { AdminNav } from "@/components/admin/admin-nav";
import { AdminUserDetail } from "@/components/admin/admin-user-detail";
import { adminGetUser, type AdminUserDetailResponse } from "@/lib/api";
import { requireAdmin, getSessionCookieHeader } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  await requireAdmin(`/admin/users/${userId}`);
  const cookieHeader = await getSessionCookieHeader();

  let detail: AdminUserDetailResponse;
  try {
    detail = await adminGetUser(userId, cookieHeader);
  } catch {
    notFound();
  }

  return (
    <div className="min-h-screen">
      <PublicHeader />
      <main className="container-shell space-y-6 py-8">
        <AdminNav />
        <AdminUserDetail detail={detail} />
      </main>
    </div>
  );
}
