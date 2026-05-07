"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Plus,
  RefreshCcw,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Swords,
  Archive,
} from "lucide-react";
import { getMyDeals } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import { PublicHeader } from "@/components/layout/public-header";
import { StatusBadge } from "@/components/deal/status-badge";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/providers/app-providers";
import type { SessionUser } from "@/components/providers/app-providers";

type DealCard = {
  public_id: string;
  status: string;
  creator_role: string;
  amount: number | null;
  currency: string;
  product_title: string | null;
  participants: { role: string; name: string | null }[];
  updated_at: string;
};

type DashboardData = {
  pending_action: DealCard[];
  active: DealCard[];
  disputed: DealCard[];
  completed: DealCard[];
};

const TABS = [
  { id: "pending_action" as const, label: "Needs Action", icon: Clock, color: "text-amber-600" },
  { id: "active" as const, label: "Active", icon: CheckCircle2, color: "text-green-600" },
  { id: "disputed" as const, label: "Disputed", icon: Swords, color: "text-orange-600" },
  { id: "completed" as const, label: "Completed", icon: Archive, color: "text-gray-500" },
];

type TabId = "pending_action" | "active" | "disputed" | "completed";

function DealCardItem({ deal, locale }: { deal: DealCard; locale: string }) {
  const counterparty = deal.participants.find((p) => p.role !== deal.creator_role);
  return (
    <Link
      href={`/d/${deal.public_id}`}
      className="group block rounded-2xl border border-[var(--border)] bg-[var(--surface-strong)] p-5 transition hover:border-[var(--brand)] hover:shadow-lg"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-[var(--ink)]">
            {deal.product_title || "Untitled Product"}
          </p>
          <p className="mt-1 text-sm text-[var(--ink-soft)]">
            {deal.creator_role === "buyer" ? "Buying from" : "Selling to"}:{" "}
            <span className="font-medium">
              {counterparty?.name || "Counterparty pending"}
            </span>
          </p>
        </div>
        <StatusBadge status={deal.status} />
      </div>
      <div className="mt-4 flex items-center justify-between">
        <p className="text-xl font-bold text-[var(--ink)]">
          {formatCurrency(deal.amount, deal.currency, locale)}
        </p>
        <span className="text-xs text-[var(--ink-soft)] transition group-hover:text-[var(--brand)]">
          Open Room →
        </span>
      </div>
    </Link>
  );
}

function EmptyTab({ tab }: { tab: (typeof TABS)[number] }) {
  const Icon = tab.icon;
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface-muted)] px-8 py-16 text-center">
      <Icon className={`mb-3 h-10 w-10 opacity-40 ${tab.color}`} />
      <p className="font-medium text-[var(--ink-soft)]">
        No {tab.label.toLowerCase()} deals
      </p>
      {tab.id === "pending_action" && (
        <Link href="/deals/new" className="mt-4">
          <Button className="gap-2 px-3 py-1.5 text-sm">
            <Plus className="h-3.5 w-3.5" />
            Create your first deal
          </Button>
        </Link>
      )}
    </div>
  );
}

export function DashboardPage({ user }: { user: SessionUser }) {
  const { locale } = useI18n();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>("pending_action");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getMyDeals();
      setData(res as DashboardData);
    } catch {
      setError("Failed to load deals. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const currentDeals: DealCard[] = data ? (data[activeTab] as DealCard[]) : [];
  const totalNeedingAction = data?.pending_action.length ?? 0;

  return (
    <div className="min-h-screen">
      <PublicHeader />
      <main className="container-shell py-8 pb-20">
        <div className="mx-auto max-w-4xl">
          {/* Header */}
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-[var(--ink)]">
                Welcome back{user.name ? `, ${user.name.split(" ")[0]}` : ""}
              </h1>
              <p className="mt-1 text-sm text-[var(--ink-soft)]">
                {totalNeedingAction > 0
                  ? `${totalNeedingAction} deal${totalNeedingAction > 1 ? "s" : ""} need your attention`
                  : "All caught up!"}
              </p>
            </div>
            <Link href="/deals/new">
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">New Deal</span>
              </Button>
            </Link>
          </div>

          {/* Tab bar */}
          <div className="mb-6 flex gap-1 rounded-xl bg-[var(--surface-muted)] p-1">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const count = data ? (data[tab.id] as DealCard[]).length : 0;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition ${
                    isActive
                      ? "bg-[var(--surface-strong)] text-[var(--ink)] shadow-sm"
                      : "text-[var(--ink-soft)] hover:text-[var(--ink)]"
                  }`}
                >
                  <Icon className={`h-3.5 w-3.5 ${isActive ? tab.color : ""}`} />
                  <span className="hidden sm:inline">{tab.label}</span>
                  {count > 0 && (
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-xs font-bold ${
                        isActive
                          ? "bg-[var(--brand)] text-white"
                          : "bg-[var(--border)] text-[var(--ink-soft)]"
                      }`}
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Content */}
          {loading ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="h-32 animate-pulse rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)]"
                />
              ))}
            </div>
          ) : error ? (
            <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
              <AlertTriangle className="h-5 w-5 shrink-0 text-red-600" />
              <p className="text-sm text-red-700">{error}</p>
              <Button
                onClick={() => void load()}
                variant="ghost"
                className="ml-auto gap-2 text-sm"
              >
                <RefreshCcw className="h-3.5 w-3.5" /> Retry
              </Button>
            </div>
          ) : currentDeals.length === 0 ? (
            <EmptyTab tab={TABS.find((t) => t.id === activeTab)!} />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {currentDeals.map((deal) => (
                <DealCardItem key={deal.public_id} deal={deal} locale={locale} />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
