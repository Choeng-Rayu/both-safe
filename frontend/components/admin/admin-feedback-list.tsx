"use client";

import { useCallback, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  adminListFeedback,
  type AdminFeedbackItem,
} from "@/lib/api";

interface ListResponse {
  items: AdminFeedbackItem[];
  total: number;
  page: number;
  pageSize: number;
  summary: { total: number; avg_rating: number | null };
}

interface Filters {
  minRating: string;
  role: "" | "buyer" | "seller";
}

export function AdminFeedbackList({
  initial,
  initialFilters,
}: {
  initial: ListResponse;
  initialFilters: Filters;
}) {
  const router = useRouter();
  const [data, setData] = useState<ListResponse>(initial);
  const [filters, setFilters] = useState<Filters>(initialFilters);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const refresh = useCallback(
    async (next: Filters, page = 1) => {
      try {
        setError(null);
        const result = await adminListFeedback({
          minRating: next.minRating || undefined,
          role: (next.role || undefined) as "buyer" | "seller" | undefined,
          page: String(page),
          pageSize: "25",
        });
        setData(result);
        const params = new URLSearchParams();
        if (next.minRating) params.set("minRating", next.minRating);
        if (next.role) params.set("role", next.role);
        if (page > 1) params.set("page", String(page));
        const qs = params.toString();
        router.replace(`/admin/feedback${qs ? `?${qs}` : ""}`);
      } catch (err) {
        setError((err as Error).message ?? "Failed to load feedback");
      }
    },
    [router],
  );

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(() => void refresh(filters, 1));
  }

  const lastPage = Math.max(1, Math.ceil(data.total / data.pageSize));

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat
          label="Total feedback"
          value={data.summary.total.toString()}
        />
        <Stat
          label="Average rating"
          value={
            data.summary.avg_rating !== null
              ? `${data.summary.avg_rating} / 5`
              : "—"
          }
        />
        <Stat label="Showing" value={`${data.items.length} of ${data.total}`} />
      </div>

      <form
        onSubmit={handleSubmit}
        className="flex flex-wrap items-end gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] p-4"
      >
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-[var(--ink)]">Min rating</span>
          <select
            value={filters.minRating}
            onChange={(e) =>
              setFilters((prev) => ({ ...prev, minRating: e.target.value }))
            }
            className="rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm"
          >
            <option value="">All</option>
            <option value="1">1+ ⭐</option>
            <option value="2">2+ ⭐</option>
            <option value="3">3+ ⭐</option>
            <option value="4">4+ ⭐</option>
            <option value="5">5 ⭐ only</option>
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-[var(--ink)]">Role</span>
          <select
            value={filters.role}
            onChange={(e) =>
              setFilters((prev) => ({
                ...prev,
                role: e.target.value as Filters["role"],
              }))
            }
            className="rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm"
          >
            <option value="">All</option>
            <option value="buyer">Buyers</option>
            <option value="seller">Sellers</option>
          </select>
        </label>
        <Button type="submit" disabled={isPending}>
          Apply
        </Button>
      </form>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface-strong)]">
        <table className="w-full text-left text-sm">
          <thead className="bg-[var(--surface-muted)] text-xs uppercase text-[var(--ink-soft)]">
            <tr>
              <th className="px-4 py-3">Deal</th>
              <th className="px-4 py-3">From</th>
              <th className="px-4 py-3">Rating</th>
              <th className="px-4 py-3">Comment</th>
              <th className="px-4 py-3">Date</th>
            </tr>
          </thead>
          <tbody>
            {data.items.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-12 text-center text-sm text-[var(--ink-soft)]"
                >
                  No feedback yet for this filter.
                </td>
              </tr>
            )}
            {data.items.map((entry) => (
              <tr
                key={entry.id}
                className={`border-t border-[var(--border)] align-top ${
                  entry.rating <= 2 ? "bg-red-50/50" : ""
                }`}
              >
                <td className="px-4 py-3">
                  {entry.deal_id ? (
                    <Link
                      href={`/admin/deals/${entry.deal_id}`}
                      className="text-[var(--brand-strong)] hover:underline font-mono text-xs"
                    >
                      {entry.deal_public_id ?? entry.deal_id.slice(0, 8)}
                    </Link>
                  ) : (
                    "—"
                  )}
                  <p className="mt-1 text-xs text-[var(--ink-soft)]">
                    {entry.deal_status ?? ""}
                  </p>
                </td>
                <td className="px-4 py-3">
                  <p className="text-xs uppercase text-[var(--ink-soft)]">
                    {entry.role}
                  </p>
                  <p className="text-sm text-[var(--ink)]">
                    {entry.user_name ?? entry.user_email ?? "Anonymous"}
                  </p>
                  {entry.user_email && entry.user_name ? (
                    <p className="text-xs text-[var(--ink-soft)]">
                      {entry.user_email}
                    </p>
                  ) : null}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-0.5">
                    {[1, 2, 3, 4, 5].map((v) => (
                      <Star
                        key={v}
                        className={`h-4 w-4 ${
                          v <= entry.rating
                            ? "fill-amber-400 text-amber-500"
                            : "text-amber-200"
                        }`}
                      />
                    ))}
                    <span className="ml-1 text-xs font-medium text-[var(--ink)]">
                      {entry.rating}/5
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3 max-w-md">
                  {entry.comment ? (
                    <p className="whitespace-pre-line text-sm text-[var(--ink)]">
                      {entry.comment}
                    </p>
                  ) : (
                    <span className="text-xs italic text-[var(--ink-soft)]">
                      No comment
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-[var(--ink-soft)]">
                  {new Date(entry.created_at).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm text-[var(--ink-soft)]">
        <span>
          Page {data.page} of {lastPage} · {data.total} entries
        </span>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            disabled={data.page <= 1}
            onClick={() => void refresh(filters, data.page - 1)}
          >
            Previous
          </Button>
          <Button
            variant="ghost"
            disabled={data.page >= lastPage}
            onClick={() => void refresh(filters, data.page + 1)}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] p-4">
      <p className="text-xs uppercase tracking-wide text-[var(--ink-soft)]">
        {label}
      </p>
      <p className="mt-1 text-lg font-semibold text-[var(--ink)]">{value}</p>
    </div>
  );
}
