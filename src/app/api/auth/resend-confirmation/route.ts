import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { sendSignupConfirmationEmail } from "@/lib/email/client";
import { normalizeEmail } from "@/lib/provisioning/domains";
import {
  findActiveProvisionByEmail,
  isProvisionedPocEmail,
} from "@/lib/provisioning/organization-provisions";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://sequence-ai.com";

const MAX_TRACKED_IPS = 10_000;
const ipTimestamps = new Map<string, number[]>();
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT = 3;

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
  const ip =
    request.headers.get("x-real-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown";

  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429 }
    );
  }

  let body: { email?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { email } = body;
  if (!email) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }
  const normalizedEmail = normalizeEmail(email);

  const supabase = createServiceClient();
  const provision = await findActiveProvisionByEmail(supabase, normalizedEmail).catch((error) => {
    console.error("[resend-confirmation] provision lookup error:", error);
    return null;
  });
  if (!provision || provision.status !== "provisioned" || !isProvisionedPocEmail(provision, normalizedEmail)) {
    return NextResponse.json({ sent: true });
  }

  // Look up user by email to get their name for the email template.
  // Always return success to prevent email enumeration.
  const { data: userData } = await supabase.auth.admin.listUsers();
  const existingUser = userData?.users?.find(
    (u) => u.email === normalizedEmail && !u.email_confirmed_at
  );

  if (!existingUser) {
    return NextResponse.json({ sent: true });
  }

  const fullName =
    (existingUser.user_metadata?.full_name as string) ??
    normalizedEmail.split("@")[0];

  const { data: linkData, error: linkErr } =
    await supabase.auth.admin.generateLink({
      type: "signup",
      email: normalizedEmail,
      password: undefined as unknown as string,
      options: {
        data: existingUser.user_metadata,
        redirectTo: `${APP_URL}/onboarding`,
      },
    });

  if (linkErr) {
    console.error("[resend-confirmation] generateLink error:", linkErr.message);
    return NextResponse.json({ sent: true });
  }

  const confirmUrl = linkData?.properties?.action_link;
  if (!confirmUrl) {
    console.error("[resend-confirmation] No action_link");
    return NextResponse.json({ sent: true });
  }

  try {
    await sendSignupConfirmationEmail({ to: normalizedEmail, fullName, confirmUrl });
  } catch (err) {
    console.error(
      "[resend-confirmation] Email send failed:",
      err instanceof Error ? err.message : err
    );
  }

  return NextResponse.json({ sent: true });
}
