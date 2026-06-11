import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { sendSignupConfirmationEmail } from "@/lib/email/client";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.sequence-ai.com";

const ipTimestamps = new Map<string, number[]>();
const RATE_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const RATE_LIMIT = 5; // max signups per IP per window

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const timestamps = (ipTimestamps.get(ip) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  if (timestamps.length >= RATE_LIMIT) return true;
  timestamps.push(now);
  ipTimestamps.set(ip, timestamps);
  return false;
}

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (isRateLimited(ip)) {
    return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
  }

  let body: { email?: string; password?: string; fullName?: string; organisation?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { email, password, fullName, organisation } = body;
  if (!email || !password || !fullName) {
    return NextResponse.json({ error: "email, password, and fullName are required" }, { status: 400 });
  }

  if (password.length < 6) {
    return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { data: linkData, error: linkErr } = await supabase.auth.admin.generateLink({
    type: "signup",
    email,
    password,
    options: {
      data: { full_name: fullName, organisation },
      redirectTo: `${APP_URL}/onboarding`,
    },
  });

  if (linkErr) {
    // Always return the same response to prevent email enumeration
    console.error("[signup] generateLink error:", linkErr.message);
    return NextResponse.json({ confirmSent: true });
  }

  const confirmUrl = linkData?.properties?.action_link;
  if (!confirmUrl) {
    console.error("[signup] No action_link in generateLink response");
    return NextResponse.json({ confirmSent: true });
  }

  try {
    await sendSignupConfirmationEmail({
      to: email,
      fullName,
      confirmUrl,
    });
  } catch (err) {
    console.error("[signup] Email send failed:", err instanceof Error ? err.message : err);
  }

  return NextResponse.json({ confirmSent: true });
}
