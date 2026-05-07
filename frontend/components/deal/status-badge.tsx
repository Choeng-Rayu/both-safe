import type { FC } from 'react';

type StatusBadgeProps = { status: string; className?: string };

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  DRAFT:                        { label: 'Draft',               bg: 'bg-gray-100',                   text: 'text-gray-600',   dot: 'bg-gray-400' },
  PENDING_BUYER_PAYMENT:        { label: 'Awaiting Payment',    bg: 'bg-amber-50',                   text: 'text-amber-700',  dot: 'bg-amber-500' },
  PENDING_SELLER_APPROVAL:      { label: 'Awaiting Seller',     bg: 'bg-blue-50',                    text: 'text-blue-700',   dot: 'bg-blue-500' },
  PAYMENT_PENDING_VERIFICATION: { label: 'Verifying Payment',   bg: 'bg-purple-50',                  text: 'text-purple-700', dot: 'bg-purple-500' },
  PAID_WAITING_SELLER_APPROVAL: { label: 'Paid — Seller Must Accept', bg: 'bg-indigo-50',           text: 'text-indigo-700', dot: 'bg-indigo-500' },
  SELLER_ACCEPTED_PACKING:      { label: 'Packing',             bg: 'bg-teal-50',                    text: 'text-teal-700',   dot: 'bg-teal-500' },
  PAID_ESCROWED:                { label: 'Paid & Escrowed',     bg: 'bg-green-50',                   text: 'text-green-700',  dot: 'bg-green-500' },
  SHIPPED:                      { label: 'Shipped',             bg: 'bg-cyan-50',                    text: 'text-cyan-700',   dot: 'bg-cyan-500' },
  DISPUTED:                     { label: 'Disputed',            bg: 'bg-orange-50',                  text: 'text-orange-700', dot: 'bg-orange-500' },
  RELEASED:                     { label: 'Released',            bg: 'bg-green-100',                  text: 'text-green-800',  dot: 'bg-green-600' },
  REFUNDED:                     { label: 'Refunded',            bg: 'bg-sky-50',                     text: 'text-sky-700',    dot: 'bg-sky-500' },
  CANCELLED:                    { label: 'Cancelled',           bg: 'bg-gray-100',                   text: 'text-gray-500',   dot: 'bg-gray-400' },
  EXPIRED:                      { label: 'Expired',             bg: 'bg-gray-100',                   text: 'text-gray-400',   dot: 'bg-gray-300' },
};

export const StatusBadge: FC<StatusBadgeProps> = ({ status, className = '' }) => {
  const cfg = STATUS_CONFIG[status] ?? { label: status, bg: 'bg-gray-100', text: 'text-gray-600', dot: 'bg-gray-400' };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${cfg.bg} ${cfg.text} ${className}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
};
