import type {
  DEAL_ALLOWED_ACTIONS,
  DEAL_STATUSES,
  DISPUTE_REASONS,
  LOCALES,
  ROLES,
} from "@/lib/constants";

export type DealStatus = (typeof DEAL_STATUSES)[number];
export type Role = (typeof ROLES)[number];
export type Locale = (typeof LOCALES)[number];
export type DealAllowedAction = (typeof DEAL_ALLOWED_ACTIONS)[number];
export type DisputeReason = (typeof DISPUTE_REASONS)[number];

export type ParticipantSummary = {
  role: "buyer" | "seller";
  name: string | null;
  preferred_language: Locale | null;
  approved_at: string | null;
  joined_at: string | null;
  has_payout: boolean;
};

export type ProductSummary = {
  title: string | null;
  type: string | null;
  description: string | null;
  image_url: string | null;
  quantity: number | null;
  condition: string | null;
} | null;

export type PaymentSummary = {
  payment_id: string;
  admin_status: string;
  paid_amount: number | null;
  expected_amount: number | null;
  receiver_account_label: string | null;
  proof_image_url: string | null;
  rejected_reason: string | null;
} | null;

export type ShippingSummary = {
  shipping_id: string;
  delivery_company: string | null;
  tracking_number: string | null;
  package_photo_url: string | null;
  delivery_receipt_url: string | null;
  seller_note: string | null;
} | null;

export type DisputeSummaryItem = {
  dispute_id: string;
  reason: DisputeReason;
  message: string;
  status: string;
  opened_by_role: Role;
  created_at: string;
  resolved_at: string | null;
};

export type TimelineItem = {
  id: string;
  eventKey: string;
  messageKey: string;
  payload: string | null;
  channel: string;
  recipientRef: string | null;
  createdAt: string;
};

export type DealResponse = {
  public_id: string;
  status: DealStatus;
  creator_role: "buyer" | "seller";
  currency: string;
  amount: number | null;
  fee_amount: number | null;
  net_seller_amount: number | null;
  current_user_role: Role | null;
  participants: ParticipantSummary[];
  product: ProductSummary;
  missing_fields: string[];
  missing_approvals?: string[];
  allowed_actions: DealAllowedAction[];
  payment_summary: PaymentSummary;
  shipping_summary: ShippingSummary;
  dispute_summary: DisputeSummaryItem[] | null;
  timeline: TimelineItem[];
};

export type CreateDealResponse = {
  public_id: string;
  status: DealStatus;
  creator_access_url: string;
  invite_url: string;
  missing_fields: string[];
  message_key: string;
};

export type JoinDealResponse = {
  participant_access_url: string;
  access_token: string;
  status: DealStatus;
  missing_fields: string[];
  allowed_actions: DealAllowedAction[];
};

export type AdminLoginResponse = {
  token: string;
  admin: {
    id: string;
    email: string;
    name: string | null;
  };
};

export type AdminDealsResponse = {
  items: AdminDealRecord[];
  total: number;
  page: number;
  pageSize: number;
};

export type AdminDealRecord = {
  id: string;
  publicId: string;
  status: DealStatus;
  creatorRole: "buyer" | "seller";
  currency: string;
  amount: number | null;
  participants: Array<{
    id: string;
    role: "buyer" | "seller";
    name: string | null;
    preferredLanguage: Locale | null;
    approvedAt: string | null;
    joinedAt: string | null;
    payoutKhqr?: string | null;
    payoutBankName?: string | null;
    payoutAccountName?: string | null;
    payoutAccountNumber?: string | null;
    payoutKhqrImage?: string | null;
  }>;
  product: {
    title: string | null;
    type: string | null;
    description: string | null;
  } | null;
  createdAt: string;
};

export type AdminDealDetail = AdminDealRecord & {
  netSellerAmount: number | null;
  payments: Array<{
    id: string;
    adminStatus: string;
    paidAmount: number | null;
    expectedAmount: number | null;
    proofImageUrl: string | null;
    receiverAccountLabel: string | null;
    rejectedReason: string | null;
    createdAt: string;
  }>;
  shipping: {
    id: string;
    deliveryCompany: string | null;
    trackingNumber: string | null;
    packagePhotoUrl: string | null;
    deliveryReceiptUrl: string | null;
    sellerNote: string | null;
    createdAt: string;
  } | null;
  disputes: Array<{
    id: string;
    reason: string;
    message: string;
    evidenceUrls: string | null;
    status: string;
    adminNote: string | null;
    createdAt: string;
  }>;
  ledgerEntries: Array<{
    id: string;
    entryType: string;
    amount: number;
    currency: string;
    reference: string | null;
    createdAt: string;
  }>;
};
