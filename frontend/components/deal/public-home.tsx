"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, MessageCircleMore, ShieldCheck, Truck, Lock, CreditCard, CheckCircle2, QrCode } from "lucide-react";
import { PublicHeader } from "@/components/layout/public-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/components/providers/app-providers";
import Image from "next/image";

export function PublicHome() {
  const { t } = useI18n();
  const router = useRouter();
  const [openLink, setOpenLink] = useState("");

  const quickSteps = useMemo(
    () => [
      { title: t("landing.steps.one"), desc: "Seller or Buyer creates the room with product and price details." },
      { title: t("landing.steps.two"), desc: "Paste the link directly into your Telegram, Messenger, or WeChat." },
      { title: t("landing.steps.three"), desc: "Buyer sends payment to BothSafe via KHQR. We hold the money." },
      { title: "Seller Ships & Gets Paid", desc: "Once the buyer confirms delivery, BothSafe releases the money." }
    ],
    [t],
  );

  return (
    <div className="min-h-screen flex flex-col">
      <PublicHeader />
      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative overflow-hidden bg-[var(--surface-strong)] py-16 sm:py-24">
          <div className="absolute inset-0 bg-gradient-to-b from-[var(--surface-muted)]/50 to-transparent" />
          <div className="container-shell relative flex flex-col items-center text-center">
            <span className="eyebrow mb-4 inline-flex items-center gap-2 rounded-full bg-[var(--brand)]/10 px-3 py-1 text-[var(--brand)]">
              <ShieldCheck className="h-4 w-4" /> The Trust Layer for Cambodia
            </span>
            <h1 className="max-w-3xl text-4xl font-bold tracking-tight text-[var(--ink)] sm:text-6xl mb-6">
              {t("landing.hero.title")}
            </h1>
            <p className="max-w-2xl text-lg leading-8 text-[var(--ink-soft)] mb-10">
              BothSafe acts as a trusted escrow layer between you and the other party. We protect your money until the product is successfully delivered.
              <br className="hidden sm:block" />
              {t("landing.hero.body")}
            </p>
            <div className="flex flex-col sm:flex-row items-center gap-4 w-full max-w-md mx-auto">
              <Link href="/deals/new?role=seller" className="w-full">
                <Button className="w-full h-12 text-base px-6 shadow-md hover:shadow-lg transition-all">
                  {t("deal.action.create_seller")}
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Link href="/deals/new?role=buyer" className="w-full">
                <Button variant="secondary" className="w-full h-12 text-base px-6 shadow-sm hover:shadow transition-all">
                  {t("deal.action.create_buyer")}
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
            </div>
            
            <div className="mt-16 w-full max-w-2xl">
              <div className="soft-card rounded-2xl p-2 sm:p-3 bg-[var(--surface-strong)] shadow-xl border border-[var(--brand)]/20">
                <div className="flex flex-col sm:flex-row gap-2">
                  <Input
                    value={openLink}
                    onChange={(event) => setOpenLink(event.target.value)}
                    placeholder="Have an invite link? Paste here (e.g. https://bothsafe.app/d/...)"
                    className="h-12 border-none bg-[var(--surface-muted)] focus-visible:ring-1 focus-visible:ring-[var(--brand)]/50"
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
                    className="h-12 px-8 sm:w-auto shrink-0"
                  >
                    {t("common.open")} Deal
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Value Prop / Features */}
        <section className="container-shell py-20">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-semibold text-[var(--ink)]">Why use BothSafe?</h2>
            <p className="mt-4 text-lg text-[var(--ink-soft)]">Stop worrying about fake buyers or scam sellers.</p>
          </div>
          <div className="grid gap-8 md:grid-cols-3">
            <FeatureCard
              icon={<Lock className="h-6 w-6" aria-hidden="true" />}
              title="Escrow Payment Protection"
              description="Buyers pay BothSafe first. We hold the money securely in escrow until the item is delivered and confirmed."
            />
            <FeatureCard
              icon={<MessageCircleMore className="h-6 w-6" aria-hidden="true" />}
              title="Social Commerce Ready"
              description="Just share the BothSafe link directly in your existing Telegram, Messenger, or WeChat chat to close the deal."
            />
            <FeatureCard
              icon={<QrCode className="h-6 w-6" aria-hidden="true" />}
              title="Easy KHQR Payments"
              description="Pay directly with Bakong or your preferred local bank app. Simple, fast, and secure."
            />
          </div>
        </section>

        {/* How It Works Section */}
        <section className="bg-[var(--surface-strong)] py-20 border-t border-[var(--border)]">
          <div className="container-shell">
            <div className="grid gap-16 lg:grid-cols-2 lg:items-center">
              <div>
                <h2 className="text-3xl font-semibold text-[var(--ink)] mb-8">How it works</h2>
                <div className="space-y-8">
                  {quickSteps.map((step, index) => (
                    <div key={index} className="flex gap-4">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--brand)]/10 text-[var(--brand)] font-bold text-lg border border-[var(--brand)]/20">
                        {index + 1}
                      </div>
                      <div>
                        <h3 className="text-lg font-medium text-[var(--ink)] mb-1">{step.title}</h3>
                        <p className="text-[var(--ink-soft)] leading-relaxed">{step.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="relative flex justify-center lg:justify-end">
                <div className="w-full max-w-md soft-card p-8 rounded-3xl bg-gradient-to-br from-[var(--surface-strong)] to-[var(--surface-muted)] relative">
                  <div className="absolute top-0 right-0 -mr-6 -mt-6 rounded-2xl bg-[var(--surface-strong)] p-4 shadow-xl border border-[var(--border)]">
                    <Image src="/logo.png" alt="BothSafe Protection" width={64} height={64} className="h-16 w-auto" />
                  </div>
                  <div className="space-y-6">
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="h-6 w-6 text-[var(--success)]" />
                      <span className="font-medium">Deal Approved</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="h-6 w-6 text-[var(--success)]" />
                      <span className="font-medium">Buyer Paid (In Escrow)</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Truck className="h-6 w-6 text-[var(--brand)]" />
                      <span className="font-medium text-[var(--ink)]">Seller is Shipping...</span>
                    </div>
                    <div className="flex items-center gap-3 opacity-50">
                      <CreditCard className="h-6 w-6" />
                      <span>Payment Released</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Footer CTA */}
        <section className="py-20 bg-[var(--brand)] text-white text-center">
          <div className="container-shell">
            <h2 className="text-3xl font-semibold mb-6">Ready to secure your next deal?</h2>
            <p className="text-[var(--surface-muted)] mb-10 max-w-xl mx-auto text-lg">
              Create a BothSafe deal room in seconds and share the link with your buyer or seller. No app download required.
            </p>
            <Link href="/deals/new?role=seller">
              <Button className="bg-white text-[var(--brand)] hover:bg-[var(--surface-muted)] h-14 px-8 text-lg rounded-xl">
                Start a Protected Deal Now
              </Button>
            </Link>
          </div>
        </section>
      </main>
      
      <footer className="py-8 border-t border-[var(--border)] bg-[var(--surface-strong)] text-center text-sm text-[var(--ink-soft)]">
        <div className="container-shell">
          <p>© {new Date().getFullYear()} BothSafe. The Trust Layer for Cambodia.</p>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="soft-card rounded-2xl p-8 hover:shadow-xl transition-shadow duration-300 group">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--brand)]/10 text-[var(--brand)] mb-6 group-hover:bg-[var(--brand)] group-hover:text-white transition-colors">
        {icon}
      </div>
      <h3 className="text-xl font-semibold text-[var(--ink)] mb-3">{title}</h3>
      <p className="text-[var(--ink-soft)] leading-relaxed">{description}</p>
    </div>
  );
}
