import { NextResponse } from "next/server";
import { apiSend } from "@/lib/api";

export async function POST(
  request: Request,
  context: { params: Promise<{ dealId: string }> },
) {
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { dealId } = await context.params;
  try {
    const data = await apiSend(
      `/admin/deals/${dealId}/notes`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
      { cookieHeader },
    );
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Unable to save note." }, { status: 400 });
  }
}
