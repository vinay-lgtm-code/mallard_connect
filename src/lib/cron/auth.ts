import { NextRequest, NextResponse } from "next/server";

export function requireCronAuth(request: NextRequest): NextResponse | null {
  const auth = request.headers.get("authorization");
  const expected = process.env.CRON_SECRET ? `Bearer ${process.env.CRON_SECRET}` : null;

  if (process.env.NODE_ENV === "production" && !expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (expected && auth !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return null;
}
