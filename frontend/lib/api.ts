import { buildQueryString, getApiBaseUrl } from "@/lib/utils";
import type {
  AdminDealDetail,
  AdminDealsResponse,
  AdminLoginResponse,
  CreateDealResponse,
  DealResponse,
  JoinDealResponse,
} from "@/types/api";

type RequestOptions = {
  accessToken?: string | null;
  inviteToken?: string | null;
  adminToken?: string | null;
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
  if (options?.adminToken) {
    headers.set("Authorization", `Bearer ${options.adminToken}`);
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
  section: "product" | "participant" | "delivery" | "payout",
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

export async function adminLogin(payload: { email: string; password: string }) {
  return apiSend<AdminLoginResponse>(
    "/auth/admin/login",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
  );
}

export async function adminGetDeals(params: {
  status?: string;
  page?: string;
  adminToken: string;
}) {
  return apiGet<AdminDealsResponse>(
    `/admin/deals${buildQueryString({
      status: params.status,
      page: params.page,
    })}`,
    { adminToken: params.adminToken },
  );
}

export async function adminGetDeal(dealId: string, adminToken: string) {
  return apiGet<AdminDealDetail>(`/admin/deals/${dealId}`, { adminToken });
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
  adminToken: string;
}) {
  return apiGet<{ message_key: string; withdrawals: WithdrawalAdminDetail[] }>(
    `/admin/withdrawals${buildQueryString({ status: params.status })}`,
    { adminToken: params.adminToken },
  );
}

export async function adminGetWithdrawal(id: string, adminToken: string) {
  return apiGet<{ message_key: string; withdrawal: WithdrawalAdminDetail }>(
    `/admin/withdrawals/${id}`,
    { adminToken },
  );
}

export async function adminApproveWithdrawal(id: string, adminToken: string) {
  return apiSend<{ message_key: string; withdrawal: WithdrawalSummary }>(
    `/admin/withdrawals/${id}/approve`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    },
    { adminToken },
  );
}

export async function adminCompleteWithdrawal(
  id: string,
  payload: { provider_reference?: string; admin_note?: string },
  adminToken: string,
) {
  return apiSend<{ message_key: string; withdrawal: WithdrawalSummary }>(
    `/admin/withdrawals/${id}/complete`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    { adminToken },
  );
}

export async function adminRejectWithdrawal(
  id: string,
  reason: string,
  adminToken: string,
) {
  return apiSend<{ message_key: string; withdrawal: WithdrawalSummary }>(
    `/admin/withdrawals/${id}/reject`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    },
    { adminToken },
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

export async function adminGeneratePayoutDeeplink(dealId: string, adminToken: string) {
  return apiGet<{
    deeplink: string;
    md5: string;
    seller_name: string | null;
    seller_payout_method: "khqr_id" | "bank_account" | "khqr_image" | "none";
    seller_bank_name: string | null;
    seller_account_name: string | null;
    seller_account_number: string | null;
    seller_khqr: string | null;
    seller_khqr_image: string | null;
    amount: number;
    currency: string;
    deal_public_id: string;
  }>(`/admin/deals/${dealId}/payout-deeplink`, { adminToken });
}
