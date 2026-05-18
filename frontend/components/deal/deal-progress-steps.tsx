"use client";

import { CheckCircle2, Circle } from "lucide-react";
import type { DealStatus } from "@/types/api";

type Step = { label: string; statuses: DealStatus[] };

const STEPS: Step[] = [
  { label: "Setup", statuses: ["DRAFT", "AWAITING_COUNTERPARTY"] },
  { label: "Approval", statuses: ["AWAITING_BOTH_APPROVAL"] },
  { label: "Payment", statuses: ["READY_FOR_PAYMENT", "PAYMENT_PENDING_VERIFICATION"] },
  { label: "Shipping", statuses: ["PAID_ESCROWED", "SELLER_PREPARING", "SHIPPED"] },
  { label: "Complete", statuses: ["BUYER_CONFIRMED", "RELEASE_PENDING", "RELEASED"] },
];

const TERMINAL: DealStatus[] = ["CANCELLED", "EXPIRED", "REFUNDED", "DISPUTED"];

function getStepIndex(status: DealStatus): number {
  const idx = STEPS.findIndex((s) => s.statuses.includes(status));
  return idx;
}

export function DealProgressSteps({ status }: { status: DealStatus }) {
  if (TERMINAL.includes(status)) return null;

  const current = getStepIndex(status);

  return (
    <div className="flex items-center gap-0" aria-label="Deal progress">
      {STEPS.map((step, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <div key={step.label} className="flex items-center">
            <div className="flex flex-col items-center gap-1">
              <div className={`flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all ${
                done
                  ? "border-[var(--brand)] bg-[var(--brand)] text-white"
                  : active
                  ? "border-[var(--brand)] bg-white text-[var(--brand)]"
                  : "border-[var(--border)] bg-white text-[var(--ink-soft)]"
              }`}>
                {done ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <Circle className={`h-3 w-3 ${active ? "fill-[var(--brand)]" : ""}`} />
                )}
              </div>
              <span className={`text-xs font-medium ${
                done ? "text-[var(--brand)]" : active ? "text-[var(--ink)]" : "text-[var(--ink-soft)]"
              }`}>
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`mb-4 h-0.5 w-8 sm:w-12 transition-all ${i < current ? "bg-[var(--brand)]" : "bg-[var(--border)]"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}
