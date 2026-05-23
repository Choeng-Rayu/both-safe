import { NextResponse } from "next/server";
import { apiSend } from "@/lib/api";

export async function POST(
  request: Request,
  context: { params: Promise<{ paymentId: string }> },
) {
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { paymentId } = await context.params;
  try {
    const data = await apiSend(
      `/admin/payment-proofs/${paymentId}/verify`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" },
      { cookieHeader },
    );
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Unable to verify payment." }, { status: 400 });
  }
}
