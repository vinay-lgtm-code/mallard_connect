import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { sendPasswordResetEmail } from "@/lib/email/client";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.sequence-ai.com";

const MAX_TRACKED_IPS = 10_000;
const ipTimestamps = new Map<string, number[]>();
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT = 5;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  if (ipTimestamps.size > MAX_TRACKED_IPS) {
    for (const [key, ts] of ipTimestamps) {
      if (ts[ts.length - 1] < now - RATE_WINDOW_MS) ipTimestamps.delete(key);
      if (ipTimestamps.size <= MAX_TRACKED_IPS * 0.8) break;
    }
  }
  const timestamps = (ipTimestamps.get(ip) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  if (timestamps.length >= RATE_LIMIT) return true;
  timestamps.push(now);
  ipTimestamps.set(ip, timestamps);
  return false;
}

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-real-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (isRateLimited(ip)) {
    return NextResponse.json({ success: true });
  }

  let body: { email?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { email } = body;
  if (!email) {
    return NextResponse.json({ error: "email is required" }, { status: 400 });
  }

  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase.auth.admin.generateLink({
      type: "recovery",
      email,
    });

    if (!error && data?.properties?.hashed_token) {
      const tokenHash = data.properties.hashed_token;
      const confirmUrl = `${APP_URL}/auth/confirm?token_hash=${encodeURIComponent(tokenHash)}&type=recovery&next=/reset-password`;

      await sendPasswordResetEmail({ to: email, resetUrl: confirmUrl });
    }
  } catch {
    // Swallow errors — always return success (anti-enumeration)
  }

  return NextResponse.json({ success: true });
}
