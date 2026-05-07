import { NextResponse } from "next/server";
import { getAdminToken } from "@/lib/admin-session";
import { apiGet } from "@/lib/api";

export async function GET(
  _request: Request,
  context: { params: Promise<{ dealId: string }> },
) {
  const token = await getAdminToken();
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { dealId } = await context.params;
  try {
    const data = await apiGet(`/admin/deals/${dealId}/payout-deeplink`, {
      adminToken: token,
    });
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { error: "Unable to generate payout deeplink." },
      { status: 400 },
    );
  }
}
