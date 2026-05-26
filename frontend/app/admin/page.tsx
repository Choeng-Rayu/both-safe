import Link from "next/link";
import {
  Users,
  Banknote,
  Briefcase,
  Wallet,
  Star,
  ShieldOff,
  AlertTriangle,
} from "lucide-react";
import { PublicHeader } from "@/components/layout/public-header";
import { AdminNav } from "@/components/admin/admin-nav";
import { adminGetStats } from "@/lib/api";
import { requireAdmin, getSessionCookieHeader } from "@/lib/auth";
import { formatMinor } from "@/lib/wallet-format";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  await requireAdmin("/admin");
  const cookieHeader = await getSessionCookieHeader();
  const stats = await adminGetStats(cookieHeader);

  const pendingReview = stats.withdrawals.pending_review;

  return (
    <div className="min-h-screen">
      <PublicHeader />
      <main className="container-shell space-y-6 py-8">
        <AdminNav />

        <section className="space-y-2">
          <span className="eyebrow">Admin</span>
          <h1 className="text-3xl font-semibold text-[var(--ink)]">
            Operations dashboard
          </h1>
          <p className="text-sm text-[var(--ink-soft)]">
            Live snapshot of the platform. Withdrawal approvals are the only
            place where admin action moves money — everything else is read-only.
          </p>
        </section>

        {/* Pending-action banner — most important thing for an admin */}
        {pendingReview > 0 && (
          <Link
            href="/admin/withdrawals?status=PENDING_REVIEW"
            className="flex items-center justify-between gap-3 rounded-2xl border-2 border-amber-300 bg-amber-50 p-5 transition hover:border-amber-400"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-amber-200">
                <AlertTriangle className="h-6 w-6 text-amber-700" />
              </span>
              <div>
                <p className="text-base font-semibold text-[var(--ink)]">
                  {pendingReview} withdrawal{pendingReview === 1 ? "" : "s"}{" "}
                  awaiting your approval
                </p>
                <p className="text-sm text-[var(--ink-soft)]">
                  Review each request, pay externally, then mark complete.
                </p>
              </div>
            </div>
            <span className="text-sm font-semibold text-[var(--brand-strong)]">
              Open queue →
            </span>
          </Link>
        )}

        {/* Top-line KPIs */}
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi
            href="/admin/withdrawals"
            icon={<Banknote className="h-5 w-5" />}
            label="Pending withdrawals"
            value={pendingReview.toString()}
            sub={
              stats.withdrawals.completed > 0
                ? `${stats.withdrawals.completed} completed all-time`
                : "no completed withdrawals yet"
            }
            tone={pendingReview > 0 ? "amber" : "default"}
          />
          <Kpi
            href="/admin/users"
            icon={<Users className="h-5 w-5" />}
            label="Users"
            value={stats.users.total.toString()}
            sub={`${stats.users.active} active · ${stats.users.disabled} disabled`}
          />
          <Kpi
            href="/admin/deals"
            icon={<Briefcase className="h-5 w-5" />}
            label="Deals"
            value={stats.deals.total.toString()}
            sub={`${stats.deals.in_escrow} currently in escrow`}
          />
          <Kpi
            icon={<Wallet className="h-5 w-5" />}
            label="Money in user wallets"
            value={formatMinor(stats.wallets.total_usd_minor, "USD")}
            sub={
              stats.wallets.total_khr_minor !== "0"
                ? `+ ${formatMinor(stats.wallets.total_khr_minor, "KHR")}`
                : `${stats.wallets.users_with_balance} users with balance`
            }
          />
        </section>

        {/* Detail rows */}
        <section className="grid gap-4 lg:grid-cols-3">
          <Panel title="Withdrawals by status" icon={<Banknote className="h-4 w-4" />}>
            <ul className="text-sm">
              {Object.entries(stats.withdrawals.by_status).map(
                ([status, info]) => (
                  <Row
                    key={status}
                    label={status.replace(/_/g, " ").toLowerCase()}
                    value={`${info.count}${
                      info.count > 0 && info.amount_minor !== "0"
                        ? ` · ${formatMinor(info.amount_minor, "USD")}`
                        : ""
                    }`}
                    emphasized={status === "PENDING_REVIEW" && info.count > 0}
                  />
                ),
              )}
            </ul>
            <Link
              href="/admin/withdrawals"
              className="mt-3 inline-block text-sm font-medium text-[var(--brand-strong)]"
            >
              Manage queue →
            </Link>
          </Panel>

          <Panel title="Deals by status" icon={<Briefcase className="h-4 w-4" />}>
            <ul className="text-sm">
              {Object.entries(stats.deals.by_status)
                .filter(([, count]) => count > 0)
                .sort((a, b) => b[1] - a[1])
                .map(([status, count]) => (
                  <Row
                    key={status}
                    label={status.replace(/_/g, " ").toLowerCase()}
                    value={count.toString()}
                  />
                ))}
              {Object.values(stats.deals.by_status).every((c) => c === 0) && (
                <li className="py-2 text-xs text-[var(--ink-soft)]">
                  No deals yet.
                </li>
              )}
            </ul>
            <Link
              href="/admin/deals"
              className="mt-3 inline-block text-sm font-medium text-[var(--brand-strong)]"
            >
              View deals →
            </Link>
          </Panel>

          <Panel title="Users & feedback" icon={<Star className="h-4 w-4" />}>
            <ul className="text-sm">
              <Row label="Active users" value={stats.users.active.toString()} />
              <Row
                label="Admins"
                value={stats.users.admins.toString()}
                muted
              />
              <Row
                label="Disabled"
                value={stats.users.disabled.toString()}
                emphasized={stats.users.disabled > 0}
                icon={
                  stats.users.disabled > 0 ? (
                    <ShieldOff className="h-3.5 w-3.5 text-red-600" />
                  ) : undefined
                }
              />
              <Row
                label="Feedback entries"
                value={stats.feedback.total.toString()}
              />
              <Row
                label="Average rating"
                value={
                  stats.feedback.avg_rating !== null
                    ? `${stats.feedback.avg_rating} / 5`
                    : "—"
                }
              />
              {stats.feedback.low_rating_count > 0 ? (
                <Row
                  label="Low (≤2 ⭐) feedback"
                  value={stats.feedback.low_rating_count.toString()}
                  emphasized
                />
              ) : null}
            </ul>
            <div className="mt-3 flex flex-wrap gap-3 text-sm font-medium text-[var(--brand-strong)]">
              <Link href="/admin/users">Users →</Link>
              <Link href="/admin/feedback">Feedback →</Link>
            </div>
          </Panel>
        </section>
      </main>
    </div>
  );
}

function Kpi({
  href,
  icon,
  label,
  value,
  sub,
  tone = "default",
}: {
  href?: string;
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  tone?: "default" | "amber";
}) {
  const inner = (
    <div
      className={`rounded-2xl border bg-[var(--surface-strong)] p-5 transition ${
        tone === "amber"
          ? "border-amber-300 bg-amber-50/60"
          : "border-[var(--border)] hover:border-[var(--brand)]/40"
      }`}
    >
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-[var(--ink-soft)]">
        <span>{icon}</span>
        <span>{label}</span>
      </div>
      <p className="mt-2 text-3xl font-bold text-[var(--ink)]">{value}</p>
      {sub ? (
        <p className="mt-1 text-xs text-[var(--ink-soft)]">{sub}</p>
      ) : null}
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

function Panel({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-strong)] p-5">
      <div className="flex items-center gap-2 text-sm font-semibold text-[var(--ink)]">
        <span className="text-[var(--ink-soft)]">{icon}</span>
        <span>{title}</span>
      </div>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function Row({
  label,
  value,
  emphasized = false,
  muted = false,
  icon,
}: {
  label: string;
  value: string;
  emphasized?: boolean;
  muted?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <li className="flex items-center justify-between border-t border-[var(--border)] py-2 text-sm first:border-t-0">
      <span
        className={`flex items-center gap-1.5 capitalize ${
          muted ? "text-[var(--ink-soft)]" : "text-[var(--ink)]"
        }`}
      >
        {icon}
        {label}
      </span>
      <span
        className={`font-mono ${
          emphasized ? "font-semibold text-amber-700" : "text-[var(--ink)]"
        }`}
      >
        {value}
      </span>
    </li>
  );
}
