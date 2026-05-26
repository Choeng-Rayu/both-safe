"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ExternalLink, Loader2, ShoppingBag, ShoppingCart } from "lucide-react";
import { createDeal } from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import { setStoredAccessToken, setStoredInviteLink } from "@/lib/token-store";
import { PublicHeader } from "@/components/layout/public-header";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useAuth, useI18n } from "@/components/providers/app-providers";
import { CopyLinkButton } from "@/components/deal/copy-link-button";
import { AuthRequiredDialog } from "@/components/auth/auth-required-dialog";

type CreatorRole = "buyer" | "seller";

/**
 * Create-deal form simplified per flow.deal.md.
 *
 * Per the flow document, deal creation now only collects the four
 * required fields below. Optional information (phone number, product
 * type, product description) is added later inside the deal room by
 * either party via the per-section edit screens — that keeps the
 * "start a deal" experience as fast as possible and removes
 * decision-making for fields that aren't needed yet.
 */
const initialFields = {
  creator_name: "",
  product_title: "",
  amount: "",
  currency: "USD",
};

export function CreateDealPage() {
  const { locale, t } = useI18n();
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const initialRole =
    searchParams.get("role") === "buyer" ? "buyer" : "seller";

  const [role, setRole] = useState<CreatorRole>(initialRole);
  const [fields, setFields] = useState(initialFields);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [created, setCreated] = useState<{
    creator_access_url: string;
    invite_url: string;
    public_id: string;
  } | null>(null);
  const [authDialogOpen, setAuthDialogOpen] = useState(!user);

  // Re-evaluate when the auth context changes (after the dialog
  // completes a sign-in and the user becomes available). Pre-fill
  // the creator name from the session user when empty.
  useEffect(() => {
    if (user) {
      setAuthDialogOpen(false);
      setFields((current) =>
        current.creator_name.trim() === "" && user.name
          ? { ...current, creator_name: user.name }
          : current,
      );
    } else {
      setAuthDialogOpen(true);
    }
  }, [user]);

  const requiredMissing = useMemo(() => {
    const missing: string[] = [];
    if (!fields.creator_name.trim()) missing.push("creator_name");
    if (!fields.product_title.trim()) missing.push("product_title");
    if (!fields.amount.trim()) missing.push("amount");
    return missing;
  }, [fields]);

  async function handleSubmit() {
    if (requiredMissing.length) {
      setError(t("errors.validation.failed"));
      return;
    }

    setPending(true);
    setError(null);

    try {
      const result = await createDeal({
        source: "web",
        creator_role: role,
        language: locale,
        creator_name: fields.creator_name.trim(),
        product_title: fields.product_title.trim(),
        amount: Number(fields.amount),
        currency: fields.currency,
      });

      const creatorToken =
        new URL(result.creator_access_url).searchParams.get("access") ?? "";
      setStoredAccessToken(result.public_id, creatorToken);
      setStoredInviteLink(result.public_id, result.invite_url);

      setCreated(result);
    } catch (submitError) {
      setError(getErrorMessage(submitError, t));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="min-h-screen">
      <PublicHeader />
      <main className="container-shell py-8 pb-16">
        <div
          className={`mx-auto max-w-2xl ${
            user ? "" : "pointer-events-none select-none opacity-40"
          }`}
          aria-hidden={!user}
        >
          {/* Role chooser */}
          <section className="soft-card rounded-2xl p-6">
            <span className="eyebrow">{t("deal.create.role_title")}</span>
            <h1 className="mt-3 text-3xl font-semibold text-[var(--ink)]">
              {t("deal.create.role_title")}
            </h1>
            <p className="mt-3 text-sm leading-6 text-[var(--ink-soft)]">
              {t("deal.create.form_hint")}
            </p>
            <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {(
                [
                  { value: "seller", icon: ShoppingBag },
                  { value: "buyer", icon: ShoppingCart },
                ] as { value: CreatorRole; icon: typeof ShoppingBag }[]
              ).map(({ value, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setRole(value)}
                  className={`focus-ring flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition ${
                    role === value
                      ? "border-[var(--brand)] bg-[rgba(47,106,82,0.08)]"
                      : "border-[var(--border)] bg-[var(--surface-strong)] hover:border-[var(--brand)]/40"
                  }`}
                >
                  <span
                    className={`flex h-9 w-9 items-center justify-center rounded-lg ${
                      role === value
                        ? "bg-[var(--brand)] text-white"
                        : "bg-[var(--surface-muted)] text-[var(--ink-soft)]"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <span>
                    <span className="block text-sm font-semibold text-[var(--ink)]">
                      {t(`deal.role.${value}`)}
                    </span>
                    <span className="block text-xs text-[var(--ink-soft)]">
                      {value === "seller"
                        ? t("deal.action.create_seller")
                        : t("deal.action.create_buyer")}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </section>

          {/* Required-only deal info */}
          <section className="mt-6 soft-card rounded-2xl p-6">
            <h2 className="text-lg font-semibold text-[var(--ink)]">
              Deal information
            </h2>
            <p className="mt-1 text-sm text-[var(--ink-soft)]">
              You only need these four details to start. Add product type,
              description, and contact info later inside the deal room.
            </p>

            <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Field label={t("deal.create.your_name")} required>
                  <Input
                    value={fields.creator_name}
                    onChange={(event) =>
                      setFields((current) => ({
                        ...current,
                        creator_name: event.target.value,
                      }))
                    }
                    placeholder="e.g. Sokha Lim"
                    autoComplete="name"
                  />
                </Field>
              </div>
              <div className="sm:col-span-2">
                <Field label={t("deal.create.product_title")} required>
                  <Input
                    value={fields.product_title}
                    onChange={(event) =>
                      setFields((current) => ({
                        ...current,
                        product_title: event.target.value,
                      }))
                    }
                    placeholder="e.g. iPhone 15 Pro 256GB"
                  />
                </Field>
              </div>
              <Field label={t("deal.create.amount")} required>
                <Input
                  inputMode="decimal"
                  value={fields.amount}
                  onChange={(event) =>
                    setFields((current) => ({
                      ...current,
                      amount: event.target.value,
                    }))
                  }
                  placeholder="0.00"
                />
              </Field>
              <Field label={t("deal.create.currency")} required>
                <Select
                  value={fields.currency}
                  onChange={(event) =>
                    setFields((current) => ({
                      ...current,
                      currency: event.target.value,
                    }))
                  }
                >
                  <option value="USD">USD</option>
                  <option value="KHR">KHR</option>
                </Select>
              </Field>
            </div>

            {error ? (
              <p className="mt-4 rounded-lg border border-[var(--danger)]/30 bg-[var(--danger)]/10 p-3 text-sm text-[var(--danger)]">
                {error}
              </p>
            ) : null}

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-[var(--ink-soft)]">
                After creating the room you&apos;ll get a private creator link
                and an invite link to share with the other party.
              </p>
              <Button
                onClick={handleSubmit}
                disabled={pending || requiredMissing.length > 0}
                className="w-full sm:w-auto"
              >
                {pending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                {t("deal.create.submit")}
              </Button>
            </div>
          </section>
        </div>

        {created ? (
          <section className="mx-auto mt-8 max-w-2xl soft-card rounded-2xl p-6">
            <span className="eyebrow">{t("deal.create.create_link")}</span>
            <h3 className="mt-3 text-lg font-semibold text-[var(--ink)]">
              Your deal room is ready
            </h3>
            <p className="mt-1 text-sm text-[var(--ink-soft)]">
              Keep the creator link private. Send only the invite link to the
              other party.
            </p>
            <div className="mt-4 grid gap-4">
              <LinkCard
                label={t("deal.create.creator_link")}
                value={created.creator_access_url}
                openLabel={t("deal.action.open_room")}
                primary
              />
              <LinkCard
                label={t("deal.create.invite_link")}
                value={created.invite_url}
                openLabel={t("deal.action.share_link")}
              />
            </div>
          </section>
        ) : null}
      </main>

      <AuthRequiredDialog
        open={authDialogOpen}
        onClose={() => setAuthDialogOpen(false)}
        redirectTo={`/deals/new?role=${role}`}
        title="Sign in to create a deal"
        subtitle="BothSafe deal rooms are tied to your account so you can manage them, get notified, and receive payouts in your wallet."
        blocking={!user}
      />
    </div>
  );
}

function LinkCard({
  label,
  value,
  openLabel,
  primary = false,
}: {
  label: string;
  value: string;
  openLabel: string;
  primary?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        primary
          ? "border-[var(--brand)] bg-[rgba(47,106,82,0.06)]"
          : "border-[var(--border)] bg-[var(--surface-muted)]"
      }`}
    >
      <div className="text-sm font-semibold text-[var(--ink)]">{label}</div>
      <p className="mt-2 break-all text-xs text-[var(--ink-soft)]">{value}</p>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <CopyLinkButton value={value} />
        <Link href={value} className="sm:w-auto">
          <Button className="w-full gap-2">
            {openLabel}
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
          </Button>
        </Link>
      </div>
    </div>
  );
}
