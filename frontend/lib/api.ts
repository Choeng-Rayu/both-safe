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

// New API functions
export async function sellerAccept(
  publicId: string,
  payload: Record<string, unknown>,
  options?: RequestOptions,
) {
  return apiSend<{ status: string; message_key: string }>(
    `/deals/${publicId}/seller-accept`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    options,
  );
}

export async function sellerReject(publicId: string, options?: RequestOptions) {
  return apiSend<{ status: string; message_key: string }>(
    `/deals/${publicId}/seller-reject`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    },
    options,
  );
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
