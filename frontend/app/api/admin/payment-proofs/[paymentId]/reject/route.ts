import { NextResponse } from "next/server";
import { getAdminToken } from "@/lib/admin-session";
import { apiSend } from "@/lib/api";

export async function POST(
  request: Request,
  context: { params: Promise<{ paymentId: string }> },
) {
  const token = await getAdminToken();
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as { reason: string };
  const { paymentId } = await context.params;

  try {
    const data = await apiSend(
      `/admin/payment-proofs/${paymentId}/reject`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
      { adminToken: token },
    );
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Unable to reject payment." }, { status: 400 });
  }
}
