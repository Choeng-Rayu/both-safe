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
  });
  return parseResponse<T>(response);
}

export async function apiSend<T>(
  path: string,
  init: RequestInit,
  options?: RequestOptions,
) {
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    ...init,
    headers: buildHeaders(options, init.headers),
  });
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
      body: JSON.stringify({
        ...payload,
        access_token: options?.accessToken ?? undefined,
      }),
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
      body: JSON.stringify({ access_token: options?.accessToken ?? undefined }),
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
    currency: string;
    expected_amount: number | null;
    reference_note: string;
    khqr_payload_placeholder: string;
  }>(`/deals/${publicId}/payment-instruction`, options);
}

export async function uploadPaymentProof(
  publicId: string,
  formData: FormData,
  options?: RequestOptions,
) {
  if (options?.accessToken) {
    formData.set("access_token", options.accessToken);
  }
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
  if (options?.accessToken) {
    formData.set("access_token", options.accessToken);
  }
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
  return apiSend<{ status: string }>(
    `/deals/${publicId}/confirm-received`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ access_token: options?.accessToken ?? undefined }),
    },
    options,
  );
}

export async function openDispute(
  publicId: string,
  formData: FormData,
  options?: RequestOptions,
) {
  if (options?.accessToken) {
    formData.set("access_token", options.accessToken);
  }
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
