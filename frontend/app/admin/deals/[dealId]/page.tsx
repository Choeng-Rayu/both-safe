import Link from "next/link";
import { PublicHeader } from "@/components/layout/public-header";
import { SectionCard } from "@/components/deal/section-card";
import { AdminActionPanel } from "@/components/admin/admin-action-panel";
import { AdminNoteBox } from "@/components/admin/admin-note-box";
import { DisputeEvidenceViewer } from "@/components/admin/dispute-evidence-viewer";
import { PaymentProofViewer } from "@/components/admin/payment-proof-viewer";
import { ShippingProofViewer } from "@/components/admin/shipping-proof-viewer";
import { adminGetDeal } from "@/lib/api";
import { requireAdminToken } from "@/lib/admin-session";
import { formatCurrency } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminDealDetailPage({
  params,
}: {
  params: Promise<{ dealId: string }>;
}) {
  const { dealId } = await params;
  const token = await requireAdminToken();
  const deal = await adminGetDeal(dealId, token);

  return (
    <div className="min-h-screen">
      <PublicHeader />
      <main className="container-shell grid gap-6 py-8 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-6">
          <div className="space-y-3">
            <Link href="/admin/deals" className="text-sm text-[var(--brand)]">
              Back to deals
            </Link>
            <h1 className="text-3xl font-semibold text-[var(--ink)]">
              {deal.publicId}
            </h1>
          </div>

          <SectionCard title="Deal summary">
            <div className="grid gap-3 sm:grid-cols-3">
              <Metric label="Status" value={deal.status} />
              <Metric
                label="Amount"
                value={formatCurrency(deal.amount, deal.currency)}
              />
              <Metric label="Creator role" value={deal.creatorRole} />
            </div>
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
                  <div className="mt-2 text-sm text-[var(--ink-soft)]">
                    {participant.name || "--"}
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>

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

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-4">
      <div className="text-xs text-[var(--ink-soft)]">{label}</div>
      <div className="mt-1 text-base font-semibold text-[var(--ink)]">{value}</div>
    </div>
  );
}
