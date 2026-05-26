import { buildQueryString, getApiBaseUrl } from "@/lib/utils";
import type {
  AdminDealDetail,
  AdminDealsResponse,
  CreateDealResponse,
  DealResponse,
  JoinDealResponse,
} from "@/types/api";

type RequestOptions = {
  accessToken?: string | null;
  inviteToken?: string | null;
  /**
   * Server-side only: a raw `Cookie` header value to forward to the
   * backend. Browser callers leave this undefined and rely on
   * `credentials: 'include'` to ship the session cookie automatically.
   */
  cookieHeader?: string | null;
};

export class ApiError extends Error {
  status: number;
  messageKey: string;
  details?: unknown;

  constructor(
    message: string,
    options: { status: number; messageKey: string; details?: unknown },
  ) {
    super(message);
    this.status = options.status;
    this.messageKey = options.messageKey;
    this.details = options.details;
  }
}

async function parseResponse<T>(response: Response): Promise<T> {
  const data = (await response.json().catch(() => null)) as
    | (T & { message?: string | string[]; messageKey?: string; details?: unknown })
    | null;

  if (!response.ok) {
    const message =
      typeof data?.message === "string"
        ? data.message
        : Array.isArray(data?.message)
          ? data.message.join(", ")
          : "Request failed";
    throw new ApiError(message, {
      status: response.status,
      messageKey: data?.messageKey ?? "errors.fallback",
      details: data?.details,
    });
  }

  return data as T;
}

function buildAuthQuery(options?: RequestOptions) {
  if (!options) return "";
  return buildQueryString({
    access: options.accessToken ?? undefined,
    invite: options.inviteToken ?? undefined,
  });
}

function buildHeaders(options?: RequestOptions, init?: HeadersInit) {
  const headers = new Headers(init);
  if (options?.cookieHeader) {
    headers.set("Cookie", options.cookieHeader);
  }
  return headers;
}

export async function apiGet<T>(path: string, options?: RequestOptions) {
  const response = await fetch(`${getApiBaseUrl()}${path}${buildAuthQuery(options)}`, {
    headers: buildHeaders(options),
    cache: "no-store",
    credentials: "include",
  });
  return parseResponse<T>(response);
}

export async function apiSend<T>(
  path: string,
  init: RequestInit,
  options?: RequestOptions,
) {
  const response = await fetch(
    `${getApiBaseUrl()}${path}${buildAuthQuery(options)}`,
    {
      ...init,
      headers: buildHeaders(options, init.headers),
      credentials: "include",
    },
  );
  return parseResponse<T>(response);
}

export async function createDeal(payload: Record<string, unknown>) {
  return apiSend<CreateDealResponse>(
    "/deals",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
  );
}

export async function getDeal(publicId: string, options?: RequestOptions) {
  return apiGet<DealResponse>(`/deals/${publicId}`, options);
}

export async function joinDeal(publicId: string, payload: Record<string, unknown>) {
  return apiSend<JoinDealResponse>(
    `/deals/${publicId}/join`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
  );
}

export async function updateDealSection(
  publicId: string,
  section: "product" | "participant" | "delivery",
  payload: Record<string, unknown>,
  options?: RequestOptions,
) {
  return apiSend<DealResponse>(
    `/deals/${publicId}/sections/${section}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    options,
  );
}

export async function approveDeal(publicId: string, options?: RequestOptions) {
  return apiSend<{ status: string; approved_by: string }>(
    `/deals/${publicId}/approval`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    },
    options,
  );
}

export async function getPaymentInstruction(
  publicId: string,
  options?: RequestOptions,
) {
  return apiGet<{
    method: string;
    receiver_account_label: string | null;
    receiver_account_id: string | null;
    currency: string;
    expected_amount: number | null;
    reference_note: string;
    khqr_string: string | null;
    khqr_md5: string | null;
  }>(`/deals/${publicId}/payment-instruction`, options);
}

export async function regeneratePaymentInstruction(
  publicId: string,
  options?: RequestOptions,
) {
  return apiSend<{
    method: string;
    receiver_account_label: string | null;
    receiver_account_id: string | null;
    currency: string;
    expected_amount: number | null;
    reference_note: string;
    payment_id: string;
    khqr_string: string | null;
    khqr_md5: string | null;
  }>(
    `/deals/${publicId}/payment-instruction/regenerate`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    },
    options,
  );
}

export async function uploadPaymentProof(
  publicId: string,
  formData: FormData,
  options?: RequestOptions,
) {
  return apiSend<{ payment_id: string; status: string }>(
    `/deals/${publicId}/payment-proofs`,
    {
      method: "POST",
      body: formData,
    },
    options,
  );
}

export async function uploadShippingProof(
  publicId: string,
  formData: FormData,
  options?: RequestOptions,
) {
  return apiSend<{ shipping_id: string; status: string }>(
    `/deals/${publicId}/shipping-proofs`,
    {
      method: "POST",
      body: formData,
    },
    options,
  );
}

export async function confirmReceived(publicId: string, options?: RequestOptions) {
  return apiSend<{ status: string; message_key: string }>(
    `/deals/${publicId}/confirm-received`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    },
    options,
  );
}

export async function openDispute(
  publicId: string,
  formData: FormData,
  options?: RequestOptions,
) {
  return apiSend<{ dispute_id: string; status: string }>(
    `/deals/${publicId}/disputes`,
    {
      method: "POST",
      body: formData,
    },
    options,
  );
}

export async function adminGetDeals(params: {
  status?: string;
  page?: string;
  cookieHeader?: string | null;
}) {
  return apiGet<AdminDealsResponse>(
    `/admin/deals${buildQueryString({
      status: params.status,
      page: params.page,
    })}`,
    { cookieHeader: params.cookieHeader },
  );
}

export async function adminGetDeal(dealId: string, cookieHeader?: string | null) {
  return apiGet<AdminDealDetail>(`/admin/deals/${dealId}`, { cookieHeader });
}

export async function cancelDeal(publicId: string, options?: RequestOptions) {
  return apiSend<{ status: string; message_key: string; refund_required: boolean }>(
    `/deals/${publicId}/cancel`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    },
    options,
  );
}

export async function getMyDeals() {
  return apiGet<{
    created: unknown[];
    waiting_my_approval: unknown[];
    active: unknown[];
    completed_cancelled: unknown[];
  }>("/users/me/deals");
}

// ─── Wallet ────────────────────────────────────────────────────────────────

export type WalletCurrency = "USD" | "KHR";

export interface WalletSnapshot {
  wallet_id: string;
  available_usd_minor: string;
  available_khr_minor: string;
  effective_usd_minor: string;
  effective_khr_minor: string;
}

export interface WalletLedgerEntry {
  id: string;
  entry_type: string;
  direction: string;
  amount_minor: string;
  currency: WalletCurrency;
  balance_after_minor: string;
  deal_id: string | null;
  withdrawal_id: string | null;
  payment_id: string | null;
  description: string | null;
  created_at: string;
}

export interface WithdrawalSummary {
  id: string;
  public_id: string;
  user_id: string;
  amount_minor: string;
  currency: WalletCurrency;
  destination: {
    type: "bakong_khqr" | "bank_account";
    khqr: string | null;
    khqr_image: string | null;
    bank_name: string | null;
    account_name: string | null;
    account_number: string | null;
  };
  status: string;
  rejection_reason: string | null;
  provider_reference: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface WithdrawalAdminDetail extends WithdrawalSummary {
  user?: { id: string; email: string | null; name: string | null };
  entries?: Array<{
    id: string;
    entry_type: string;
    direction: string;
    amount_minor: string;
    balance_after_minor: string;
    created_at: string;
  }>;
}

export async function getWallet() {
  return apiGet<{ message_key: string; wallet: WalletSnapshot }>("/wallet");
}

export async function getWalletLedger(params: {
  currency?: WalletCurrency;
  limit?: number;
  cursor?: string;
}) {
  return apiGet<{
    message_key: string;
    entries: WalletLedgerEntry[];
    next_cursor: string | null;
  }>(
    `/wallet/ledger${buildQueryString({
      currency: params.currency,
      limit: params.limit?.toString(),
      cursor: params.cursor,
    })}`,
  );
}

export async function createWithdrawalWithQr(input: {
  amount_minor: number;
  currency: WalletCurrency;
  provider_label?: string;
  qr_image: File;
}) {
  const form = new FormData();
  form.set("amount_minor", String(input.amount_minor));
  form.set("currency", input.currency);
  if (input.provider_label) form.set("provider_label", input.provider_label);
  form.set("qr_image", input.qr_image);
  const response = await fetch(`${getApiBaseUrl()}/wallet/withdrawals/with-image`, {
    method: "POST",
    body: form,
    credentials: "include",
  });
  return parseResponse<{ message_key: string; withdrawal: WithdrawalSummary }>(response);
}

export async function createWithdrawal(payload: {
  currency: WalletCurrency;
  amount_minor: number;
  destination: {
    type: "bakong_khqr" | "bank_account";
    khqr?: string;
    khqr_image?: string;
    bank_name?: string;
    account_name?: string;
    account_number?: string;
  };
}) {
  return apiSend<{ message_key: string; withdrawal: WithdrawalSummary }>(
    "/wallet/withdrawals",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
  );
}

export async function listMyWithdrawals() {
  return apiGet<{ message_key: string; withdrawals: WithdrawalSummary[] }>(
    "/wallet/withdrawals",
  );
}

export async function cancelWithdrawal(id: string) {
  return apiSend<{ message_key: string; withdrawal: WithdrawalSummary }>(
    `/wallet/withdrawals/${id}/cancel`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    },
  );
}

export async function adminListWithdrawals(params: {
  status?: string;
  cookieHeader?: string | null;
}) {
  return apiGet<{ message_key: string; withdrawals: WithdrawalAdminDetail[] }>(
    `/admin/withdrawals${buildQueryString({ status: params.status })}`,
    { cookieHeader: params.cookieHeader },
  );
}

export async function adminGetWithdrawal(id: string, cookieHeader?: string | null) {
  return apiGet<{ message_key: string; withdrawal: WithdrawalAdminDetail }>(
    `/admin/withdrawals/${id}`,
    { cookieHeader },
  );
}

export async function adminApproveWithdrawal(id: string) {
  return apiSend<{ message_key: string; withdrawal: WithdrawalSummary }>(
    `/admin/withdrawals/${id}/approve`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    },
  );
}

export async function adminCompleteWithdrawal(
  id: string,
  payload: { provider_reference?: string; admin_note?: string },
) {
  return apiSend<{ message_key: string; withdrawal: WithdrawalSummary }>(
    `/admin/withdrawals/${id}/complete`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
  );
}

export async function adminRejectWithdrawal(id: string, reason: string) {
  return apiSend<{ message_key: string; withdrawal: WithdrawalSummary }>(
    `/admin/withdrawals/${id}/reject`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    },
  );
}

export async function payDealFromWallet(publicId: string) {
  return apiSend<{ message_key: string; status: string; payment_id: string }>(
    `/deals/${publicId}/payments/wallet`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    },
  );
}

// ─── Admin: User management ────────────────────────────────────────────────

export interface AdminUserListItem {
  id: string;
  email: string | null;
  name: string | null;
  phone: string | null;
  role: "USER" | "ADMIN";
  disabled: boolean;
  email_verified: boolean;
  created_at: string;
  updated_at: string;
  wallet: {
    wallet_id: string;
    available_usd_minor: string;
    available_khr_minor: string;
    updated_at: string;
  } | null;
  deal_count: number;
  withdrawal_count: number;
}

export interface AdminUserDetail {
  id: string;
  email: string | null;
  name: string | null;
  phone: string | null;
  avatar_url: string | null;
  role: "USER" | "ADMIN";
  disabled: boolean;
  email_verified: boolean;
  created_at: string;
  updated_at: string;
}

export interface AdminUserDetailResponse {
  user: AdminUserDetail;
  wallet: {
    wallet_id: string;
    available_usd_minor: string;
    available_khr_minor: string;
    effective_usd_minor: string;
    effective_khr_minor: string;
  } | null;
  recent_deals: Array<{
    id: string;
    public_id: string;
    status: string;
    amount: number | null;
    currency: string;
    title: string | null;
    created_at: string;
    my_role: string | null;
  }>;
  recent_withdrawals: Array<{
    id: string;
    public_id: string;
    amount_minor: string;
    currency: WalletCurrency;
    status: string;
    created_at: string;
  }>;
}

export async function adminListUsers(params: {
  search?: string;
  role?: "USER" | "ADMIN" | "all";
  status?: "all" | "active" | "disabled";
  page?: string;
  pageSize?: string;
  cookieHeader?: string | null;
}) {
  return apiGet<{
    items: AdminUserListItem[];
    total: number;
    page: number;
    pageSize: number;
  }>(
    `/admin/users${buildQueryString({
      search: params.search,
      role: params.role,
      status: params.status,
      page: params.page,
      pageSize: params.pageSize,
    })}`,
    { cookieHeader: params.cookieHeader },
  );
}

export async function adminGetUser(
  userId: string,
  cookieHeader?: string | null,
) {
  return apiGet<AdminUserDetailResponse>(`/admin/users/${userId}`, {
    cookieHeader,
  });
}

export async function adminGetUserLedger(
  userId: string,
  params: {
    currency?: WalletCurrency;
    limit?: number;
    cursor?: string;
    cookieHeader?: string | null;
  },
) {
  return apiGet<{
    entries: WalletLedgerEntry[];
    next_cursor: string | null;
  }>(
    `/admin/users/${userId}/wallet/ledger${buildQueryString({
      currency: params.currency,
      limit: params.limit?.toString(),
      cursor: params.cursor,
    })}`,
    { cookieHeader: params.cookieHeader },
  );
}

export async function adminDisableUser(userId: string, reason?: string) {
  return apiSend<AdminUserDetail>(
    `/admin/users/${userId}/disable`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(reason ? { reason } : {}),
    },
  );
}

export async function adminEnableUser(userId: string) {
  return apiSend<AdminUserDetail>(
    `/admin/users/${userId}/enable`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    },
  );
}

// ─── User notifications ────────────────────────────────────────────────────

export interface UserNotification {
  id: string;
  deal_id: string | null;
  event_key: string;
  message_key: string;
  payload: unknown;
  delivered: boolean;
  created_at: string;
}

export async function listMyNotifications(limit = 50) {
  return apiGet<{ message_key: string; notifications: UserNotification[] }>(
    `/users/me/notifications${buildQueryString({ limit: String(limit) })}`,
  );
}

// ─── Deal feedback ─────────────────────────────────────────────────────────

export interface DealFeedbackEntry {
  id: string;
  role: "buyer" | "seller";
  rating: number;
  comment: string | null;
  created_at: string;
  updated_at: string;
}

export async function submitDealFeedback(
  publicId: string,
  payload: { rating: number; comment?: string },
  options?: RequestOptions,
) {
  return apiSend<DealFeedbackEntry>(
    `/deals/${publicId}/feedback`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    options,
  );
}

export async function getDealFeedback(
  publicId: string,
  options?: RequestOptions,
) {
  return apiGet<{ feedback: DealFeedbackEntry[] }>(
    `/deals/${publicId}/feedback`,
    options,
  );
}

// ─── Admin: Stats ──────────────────────────────────────────────────────────

export interface AdminStats {
  users: { total: number; active: number; disabled: number; admins: number };
  deals: {
    total: number;
    in_escrow: number;
    by_status: Record<string, number>;
  };
  wallets: {
    total_usd_minor: string;
    total_khr_minor: string;
    users_with_balance: number;
  };
  withdrawals: {
    pending_review: number;
    approved: number;
    processing: number;
    completed: number;
    rejected: number;
    cancelled: number;
    by_status: Record<string, { count: number; amount_minor: string }>;
  };
  feedback: {
    total: number;
    avg_rating: number | null;
    low_rating_count: number;
  };
}

export async function adminGetStats(cookieHeader?: string | null) {
  return apiGet<AdminStats>("/admin/stats", { cookieHeader });
}

// ─── Admin: Feedback ───────────────────────────────────────────────────────

export interface AdminFeedbackItem {
  id: string;
  deal_id: string;
  deal_public_id: string | null;
  deal_status: string | null;
  role: "buyer" | "seller";
  rating: number;
  comment: string | null;
  user_id: string | null;
  user_email: string | null;
  user_name: string | null;
  created_at: string;
  updated_at: string;
}

export async function adminListFeedback(params: {
  minRating?: string;
  role?: "buyer" | "seller";
  page?: string;
  pageSize?: string;
  cookieHeader?: string | null;
}) {
  return apiGet<{
    items: AdminFeedbackItem[];
    total: number;
    page: number;
    pageSize: number;
    summary: { total: number; avg_rating: number | null };
  }>(
    `/admin/feedback${buildQueryString({
      minRating: params.minRating,
      role: params.role,
      page: params.page,
      pageSize: params.pageSize,
    })}`,
    { cookieHeader: params.cookieHeader },
  );
}

