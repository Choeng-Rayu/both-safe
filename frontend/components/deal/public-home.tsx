"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, MessageCircleMore, ShieldCheck, Truck } from "lucide-react";
import { PublicHeader } from "@/components/layout/public-header";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/components/providers/app-providers";

export function PublicHome() {
  const { t } = useI18n();
  const router = useRouter();
  const [openLink, setOpenLink] = useState("");

  const quickSteps = useMemo(
    () => [t("landing.steps.one"), t("landing.steps.two"), t("landing.steps.three")],
    [t],
  );

  return (
    <div className="min-h-screen">
      <PublicHeader />
      <main>
        <section className="container-shell grid gap-10 py-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:py-16">
          <div className="space-y-6">
            <span className="eyebrow">{t("landing.cta")}</span>
            <div className="space-y-4">
              <h1 className="max-w-xl text-4xl font-semibold tracking-tight text-[var(--ink)] sm:text-5xl">
                {t("landing.hero.title")}
              </h1>
              <p className="max-w-xl text-base leading-7 text-[var(--ink-soft)] sm:text-lg">
                {t("landing.hero.body")}
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Link href="/deals/new?role=seller" className="flex-1">
                <Button className="w-full justify-between px-5">
                  {t("deal.action.create_seller")}
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Button>
              </Link>
              <Link href="/deals/new?role=buyer" className="flex-1">
                <Button variant="secondary" className="w-full justify-between px-5">
                  {t("deal.action.create_buyer")}
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Button>
              </Link>
            </div>
            <div className="soft-card rounded-lg p-5">
              <Field label={t("landing.open_room")}>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Input
                    value={openLink}
                    onChange={(event) => setOpenLink(event.target.value)}
                    placeholder="https://bothsafe.app/d/ABCD123?access=..."
                  />
                  <Button
                    onClick={() => {
                      const next = openLink.trim();
                      if (!next) return;
                      try {
                        const url = new URL(next);
                        router.push(`${url.pathname}${url.search}`);
                      } catch {
                        router.push(next);
                      }
                    }}
                    className="sm:w-auto"
                  >
                    {t("common.open")}
                  </Button>
                </div>
              </Field>
            </div>
          </div>

          <div className="grid gap-4">
            <FeatureCard
              icon={<ShieldCheck className="h-5 w-5" aria-hidden="true" />}
              title={t("landing.feature.trust")}
            />
            <FeatureCard
              icon={<MessageCircleMore className="h-5 w-5" aria-hidden="true" />}
              title={t("landing.feature.release")}
            />
            <FeatureCard
              icon={<Truck className="h-5 w-5" aria-hidden="true" />}
              title={t("landing.feature.dispute")}
            />
            <div className="soft-card rounded-lg p-5">
              <div className="eyebrow">{t("common.next")}</div>
              <ol className="mt-4 space-y-3">
                {quickSteps.map((step, index) => (
                  <li
                    key={step}
                    className="flex items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3"
                  >
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--brand)] text-sm font-semibold text-white">
                      {index + 1}
                    </span>
                    <span className="text-sm text-[var(--ink)]">{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
}: {
  icon: React.ReactNode;
  title: string;
}) {
  return (
    <div className="soft-card rounded-lg p-5">
      <div className="flex items-start gap-4">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[rgba(47,106,82,0.12)] text-[var(--brand)]">
          {icon}
        </span>
        <p className="text-sm leading-6 text-[var(--ink)]">{title}</p>
      </div>
    </div>
  );
}
