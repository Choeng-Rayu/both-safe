"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { createDeal, updateDealSection } from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import { setStoredAccessToken, setStoredInviteLink } from "@/lib/token-store";
import { PublicHeader } from "@/components/layout/public-header";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@/components/providers/app-providers";
import { CopyLinkButton } from "@/components/deal/copy-link-button";

type CreatorRole = "buyer" | "seller";

const initialSellerFields = {
  creator_name: "",
  creator_phone: "",
  product_title: "",
  product_type: "",
  product_description: "",
  amount: "",
  currency: "USD",
  payout_khqr: "",
  payout_bank_name: "",
  payout_account_name: "",
  payout_account_number: "",
};

export function CreateDealPage() {
  const { locale, t } = useI18n();
  const searchParams = useSearchParams();
  const initialRole =
    searchParams.get("role") === "buyer" ? "buyer" : "seller";

  const [role, setRole] = useState<CreatorRole>(initialRole);
  const [fields, setFields] = useState(initialSellerFields);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [created, setCreated] = useState<{
    creator_access_url: string;
    invite_url: string;
    public_id: string;
  } | null>(null);

  const requiredMissing = useMemo(() => {
    const missing = [];
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
        creator_name: fields.creator_name,
        creator_phone: fields.creator_phone || undefined,
        product_title: fields.product_title,
        product_type: fields.product_type || undefined,
        product_description: fields.product_description || undefined,
        amount: Number(fields.amount),
        currency: fields.currency,
      });

      const creatorToken =
        new URL(result.creator_access_url).searchParams.get("access") ?? "";
      setStoredAccessToken(result.public_id, creatorToken);
      setStoredInviteLink(result.public_id, result.invite_url);

      if (role === "seller" && fields.payout_khqr.trim()) {
        await updateDealSection(
          result.public_id,
          "payout",
          {
            payout_khqr: fields.payout_khqr,
            payout_bank_name: fields.payout_bank_name || undefined,
            payout_account_name: fields.payout_account_name || undefined,
            payout_account_number: fields.payout_account_number || undefined,
          },
          { accessToken: creatorToken },
        );
      }

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
        <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[0.72fr_1fr]">
          <section className="soft-card rounded-lg p-6">
            <span className="eyebrow">{t("deal.create.role_title")}</span>
            <h1 className="mt-3 text-3xl font-semibold text-[var(--ink)]">
              {t("deal.create.role_title")}
            </h1>
            <p className="mt-3 text-sm leading-6 text-[var(--ink-soft)]">
              {t("deal.create.form_hint")}
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {(["seller", "buyer"] as CreatorRole[]).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setRole(value)}
                  className={`focus-ring rounded-lg border px-4 py-4 text-left ${
                    role === value
                      ? "border-[var(--brand)] bg-[rgba(47,106,82,0.08)]"
                      : "border-[var(--border)] bg-[var(--surface-strong)]"
                  }`}
                >
                  <div className="text-sm font-semibold text-[var(--ink)]">
                    {t(`deal.role.${value}`)}
                  </div>
                  <div className="mt-1 text-xs text-[var(--ink-soft)]">
                    {value === "seller"
                      ? t("deal.action.create_seller")
                      : t("deal.action.create_buyer")}
                  </div>
                </button>
              ))}
            </div>
          </section>

          <section className="soft-card rounded-lg p-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("deal.create.your_name")} required>
                <Input
                  value={fields.creator_name}
                  onChange={(event) =>
                    setFields((current) => ({
                      ...current,
                      creator_name: event.target.value,
                    }))
                  }
                />
              </Field>
              <Field
                label={t("deal.create.phone")}
                hint={t("common.optional")}
              >
                <Input
                  value={fields.creator_phone}
                  onChange={(event) =>
                    setFields((current) => ({
                      ...current,
                      creator_phone: event.target.value,
                    }))
                  }
                />
              </Field>
              <Field label={t("deal.create.product_title")} required>
                <Input
                  value={fields.product_title}
                  onChange={(event) =>
                    setFields((current) => ({
                      ...current,
                      product_title: event.target.value,
                    }))
                  }
                />
              </Field>
              <Field label={t("deal.create.product_type")}>
                <Input
                  value={fields.product_type}
                  onChange={(event) =>
                    setFields((current) => ({
                      ...current,
                      product_type: event.target.value,
                    }))
                  }
                />
              </Field>
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
                />
              </Field>
              <Field label={t("deal.create.currency")}>
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
              <div className="sm:col-span-2">
                <Field label={t("deal.create.product_description")}>
                  <Textarea
                    value={fields.product_description}
                    onChange={(event) =>
                      setFields((current) => ({
                        ...current,
                        product_description: event.target.value,
                      }))
                    }
                  />
                </Field>
              </div>
              {role === "seller" ? (
                <>
                  <div className="sm:col-span-2">
                    <Field
                      label={t("field.payout_khqr")}
                      hint={t("deal.create.seller_payout_hint")}
                    >
                      <Textarea
                        value={fields.payout_khqr}
                        onChange={(event) =>
                          setFields((current) => ({
                            ...current,
                            payout_khqr: event.target.value,
                          }))
                        }
                      />
                    </Field>
                  </div>
                  <Field label={t("field.payout_bank_name")}>
                    <Input
                      value={fields.payout_bank_name}
                      onChange={(event) =>
                        setFields((current) => ({
                          ...current,
                          payout_bank_name: event.target.value,
                        }))
                      }
                    />
                  </Field>
                  <Field label={t("field.payout_account_name")}>
                    <Input
                      value={fields.payout_account_name}
                      onChange={(event) =>
                        setFields((current) => ({
                          ...current,
                          payout_account_name: event.target.value,
                        }))
                      }
                    />
                  </Field>
                  <Field label={t("field.payout_account_number")}>
                    <Input
                      value={fields.payout_account_number}
                      onChange={(event) =>
                        setFields((current) => ({
                          ...current,
                          payout_account_number: event.target.value,
                        }))
                      }
                    />
                  </Field>
                </>
              ) : null}
            </div>
            {error ? <p className="mt-4 text-sm text-[var(--danger)]">{error}</p> : null}
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Button onClick={handleSubmit} disabled={pending} className="sm:w-auto">
                {t("deal.create.submit")}
              </Button>
            </div>
          </section>
        </div>

        {created ? (
          <section className="mx-auto mt-8 max-w-5xl soft-card rounded-lg p-6">
            <span className="eyebrow">{t("deal.create.create_link")}</span>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <LinkCard
                label={t("deal.create.creator_link")}
                value={created.creator_access_url}
                openLabel={t("deal.action.open_room")}
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
    </div>
  );
}

function LinkCard({
  label,
  value,
  openLabel,
}: {
  label: string;
  value: string;
  openLabel: string;
}) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-4">
      <div className="text-sm font-semibold text-[var(--ink)]">{label}</div>
      <p className="mt-2 break-all text-sm text-[var(--ink-soft)]">{value}</p>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
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
