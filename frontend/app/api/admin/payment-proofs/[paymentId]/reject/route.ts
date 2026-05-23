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
      { cookieHeader },
    );
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Unable to reject payment." }, { status: 400 });
  }
}
