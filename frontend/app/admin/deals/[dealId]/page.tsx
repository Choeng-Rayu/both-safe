import Link from "next/link";
import { PublicHeader } from "@/components/layout/public-header";
import { SectionCard } from "@/components/deal/section-card";
import { AdminActionPanel } from "@/components/admin/admin-action-panel";
import { AdminNoteBox } from "@/components/admin/admin-note-box";
import { DisputeEvidenceViewer } from "@/components/admin/dispute-evidence-viewer";
import { PaymentProofViewer } from "@/components/admin/payment-proof-viewer";
import { ShippingProofViewer } from "@/components/admin/shipping-proof-viewer";
import { adminGetDeal } from "@/lib/api";
import { requireAdmin, getSessionCookieHeader } from "@/lib/auth";
import { formatCurrency } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminDealDetailPage({
  params,
}: {
  params: Promise<{ dealId: string }>;
}) {
  const { dealId } = await params;
  await requireAdmin(`/admin/deals`);
  const cookieHeader = await getSessionCookieHeader();
  const deal = await adminGetDeal(dealId, cookieHeader);

  const netAmount = deal.netSellerAmount ?? deal.amount;

  return (
    <div className="min-h-screen">
      <PublicHeader />
      <main className="container-shell grid gap-6 py-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <div className="space-y-3">
            <Link href="/admin/deals" className="text-sm text-[var(--brand)]">
              ← Back to deals
            </Link>
            <h1 className="text-3xl font-semibold text-[var(--ink)]">
              {deal.publicId}
            </h1>
          </div>

          <SectionCard title="Deal summary">
            <div className="grid gap-3 sm:grid-cols-4">
              <Metric label="Status" value={deal.status} />
              <Metric label="Total amount" value={formatCurrency(deal.amount, deal.currency)} />
              <Metric label="Net to seller" value={formatCurrency(netAmount, deal.currency)} />
              <Metric label="Creator role" value={deal.creatorRole} />
            </div>
            {deal.product && (
              <div className="mt-3 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-3 grid gap-2 sm:grid-cols-2">
                <div>
                  <span className="text-xs text-[var(--ink-soft)]">Product</span>
                  <p className="text-sm font-semibold text-[var(--ink)]">{deal.product.title ?? "—"}</p>
                </div>
                {deal.product.description && (
                  <div>
                    <span className="text-xs text-[var(--ink-soft)]">Description</span>
                    <p className="text-sm text-[var(--ink)]">{deal.product.description}</p>
                  </div>
                )}
              </div>
            )}
          </SectionCard>

          <SectionCard title="Participants">
            <div className="grid gap-4 sm:grid-cols-2">
              {deal.participants.map((participant) => (
                <div
                  key={participant.id}
                  className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-4"
                >
                  <div className="text-sm font-semibold text-[var(--ink)]">
                    {participant.role}
                  </div>
                  <div className="mt-1 text-sm text-[var(--ink-soft)]">
                    {participant.name || "--"}
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>

          {/* Seller payout details are no longer collected on the deal —
              released funds land in the seller's BothSafe wallet. */}

          <SectionCard title="Payment review">
            <PaymentProofViewer deal={deal} />
          </SectionCard>

          <SectionCard title="Shipping review">
            <ShippingProofViewer deal={deal} />
          </SectionCard>

          <SectionCard title="Disputes">
            <DisputeEvidenceViewer deal={deal} />
          </SectionCard>
        </div>

        <aside className="space-y-6">
          <SectionCard title="Admin actions">
            <AdminActionPanel deal={deal} />
          </SectionCard>
          <SectionCard title="Admin note">
            <AdminNoteBox dealId={deal.id} />
          </SectionCard>
        </aside>
      </main>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-4">
      <div className="text-xs text-[var(--ink-soft)]">{label}</div>
      <div className="mt-1 text-base font-semibold text-[var(--ink)]">{value ?? "—"}</div>
    </div>
  );
}

