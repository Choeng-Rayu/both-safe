import { NextResponse } from "next/server";
import { getAdminToken } from "@/lib/admin-session";
import { apiSend } from "@/lib/api";

export async function POST(
  _request: Request,
  context: { params: Promise<{ paymentId: string }> },
) {
  const token = await getAdminToken();
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { paymentId } = await context.params;
  try {
    const data = await apiSend(
      `/admin/payment-proofs/${paymentId}/verify`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" },
      { adminToken: token },
    );
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Unable to verify payment." }, { status: 400 });
  }
}
