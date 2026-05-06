import { NextResponse } from "next/server";
import { getAdminToken } from "@/lib/admin-session";
import { apiSend } from "@/lib/api";

export async function POST(
  request: Request,
  context: { params: Promise<{ dealId: string }> },
) {
  const token = await getAdminToken();
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { dealId } = await context.params;
  try {
    const data = await apiSend(
      `/admin/deals/${dealId}/release`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
      { adminToken: token },
    );
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Unable to release payout." }, { status: 400 });
  }
}
