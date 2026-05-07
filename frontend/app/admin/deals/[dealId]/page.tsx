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

  const seller = deal.participants.find((p) => p.role === "seller");
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

          {/* Seller payout section — admin uses this to send money */}
          {seller && (
            <SectionCard title="💸 Seller payout info">
              <div className="space-y-4">
                <div className="rounded-lg bg-[rgba(47,106,82,0.06)] border border-[rgba(47,106,82,0.2)] p-3 text-sm">
                  <span className="text-[var(--ink-soft)]">Amount to send seller: </span>
                  <span className="font-bold text-[var(--brand)] text-base">
                    {formatCurrency(netAmount, deal.currency)}
                  </span>
                  <span className="ml-3 text-[var(--ink-soft)]">
                    Memo: <code className="text-xs bg-[var(--surface-strong)] px-1 rounded">{deal.publicId}</code>
                    {deal.product?.title && (
                      <> — {deal.product.title}</>
                    )}
                  </span>
                </div>

                {seller.payoutKhqrImage && seller.payoutKhqrImage !== "pending_upload" ? (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-[var(--ink)]">
                      📱 Seller&apos;s KHQR — open your Bakong app and scan this:
                    </p>
                    <div className="flex justify-center rounded-xl border-2 border-[var(--brand)] bg-white p-5 shadow-sm">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={seller.payoutKhqrImage}
                        alt="Seller KHQR code"
                        className="max-w-xs w-full object-contain"
                      />
                    </div>
                    <a
                      href={seller.payoutKhqrImage}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-[var(--brand)] hover:underline"
                    >
                      ↗ Open full size image
                    </a>
                  </div>
                ) : seller.payoutKhqr ? (
                  <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-4">
                    <p className="text-xs text-[var(--ink-soft)] mb-1">Seller Bakong ID (enter in your Bakong app)</p>
                    <p className="text-base font-mono font-semibold text-[var(--ink)]">{seller.payoutKhqr}</p>
                  </div>
                ) : seller.payoutBankName ? (
                  <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-4 space-y-2">
                    <p className="text-xs text-[var(--ink-soft)]">Bank transfer details</p>
                    <p className="text-sm font-semibold">{seller.payoutBankName}</p>
                    {seller.payoutAccountName && <p className="text-sm">{seller.payoutAccountName}</p>}
                    {seller.payoutAccountNumber && (
                      <p className="text-sm font-mono">{seller.payoutAccountNumber}</p>
                    )}
                  </div>
                ) : (
                  <div className="rounded-lg bg-orange-50 border border-orange-200 p-3">
                    <p className="text-sm text-orange-700">
                      ⚠️ Seller has not uploaded their KHQR or payout information yet.
                    </p>
                  </div>
                )}
              </div>
            </SectionCard>
          )}

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

