import { parseJson, resolveFileUrl } from "@/lib/utils";
import type { AdminDealDetail } from "@/types/api";

export function DisputeEvidenceViewer({ deal }: { deal: AdminDealDetail }) {
  if (!deal.disputes.length) {
    return (
      <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-4 text-sm text-[var(--ink-soft)]">
        No disputes yet.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {deal.disputes.map((dispute) => {
        const evidence = parseJson<string[]>(dispute.evidenceUrls, []);
        return (
          <div
            key={dispute.id}
            className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-4"
          >
            <div className="text-sm font-semibold text-[var(--ink)]">
              {dispute.reason}
            </div>
            <p className="mt-2 text-sm text-[var(--ink-soft)]">{dispute.message}</p>
            {evidence.length ? (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {evidence.map((url) => (
                  <img
                    key={url}
                    src={resolveFileUrl(url) ?? ""}
                    alt=""
                    className="max-h-72 rounded-lg border border-[var(--border)] object-contain"
                  />
                ))}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
