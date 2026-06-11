import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { sendSignupConfirmationEmail } from "@/lib/email/client";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.sequence-ai.com";

export async function POST(request: NextRequest) {
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
    if (linkErr.message?.includes("already registered")) {
      return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 });
    }
    return NextResponse.json({ error: linkErr.message }, { status: 422 });
  }

  const confirmUrl = linkData?.properties?.action_link;
  if (!confirmUrl) {
    return NextResponse.json({ error: "Failed to generate confirmation link" }, { status: 500 });
  }

  try {
    await sendSignupConfirmationEmail({
      to: email,
      fullName,
      confirmUrl,
    });
  } catch {
    return NextResponse.json({ error: "Account created but confirmation email failed to send. Please try signing in." }, { status: 500 });
  }

  return NextResponse.json({ confirmSent: true });
}
