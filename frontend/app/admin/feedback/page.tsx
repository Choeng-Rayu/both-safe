import { PublicHeader } from "@/components/layout/public-header";
import { AdminNav } from "@/components/admin/admin-nav";
import { AdminFeedbackList } from "@/components/admin/admin-feedback-list";
import { adminListFeedback } from "@/lib/api";
import { requireAdmin, getSessionCookieHeader } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AdminFeedbackPage({
  searchParams,
}: {
  searchParams: Promise<{
    minRating?: string;
    role?: "buyer" | "seller";
    page?: string;
  }>;
}) {
  const params = await searchParams;
  await requireAdmin("/admin/feedback");
  const cookieHeader = await getSessionCookieHeader();

  const data = await adminListFeedback({
    minRating: params.minRating,
    role: params.role,
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
            User feedback
          </h1>
          <p className="text-sm text-[var(--ink-soft)]">
            Optional ratings and comments left by buyers and sellers after a
            deal completes. Use the filters to find dissatisfied users
            quickly.
          </p>
        </section>
        <AdminFeedbackList
          initial={data}
          initialFilters={{
            minRating: params.minRating ?? "",
            role: params.role ?? "",
          }}
        />
      </main>
    </div>
  );
}
