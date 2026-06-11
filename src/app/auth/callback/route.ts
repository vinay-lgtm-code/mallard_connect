import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendOAuthWelcomeEmail } from "@/lib/email/client";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user?.app_metadata?.tenant_id) {
        return NextResponse.redirect(new URL("/dashboard", origin));
      }

      // First-time OAuth signup — send welcome email (non-blocking)
      if (user?.email && user.created_at) {
        const ageMs = Date.now() - new Date(user.created_at).getTime();
        if (ageMs < 2 * 60 * 1000) {
          const fullName = user.user_metadata?.full_name ?? user.user_metadata?.name ?? "";
          const provider = user.app_metadata?.provider ?? "OAuth";
          sendOAuthWelcomeEmail({
            to: user.email,
            fullName: fullName || user.email.split("@")[0],
            provider,
          }).catch(() => {});
        }
      }

      return NextResponse.redirect(new URL("/onboarding", origin));
    }
  }

  return NextResponse.redirect(new URL("/login?error=auth_callback_failed", origin));
}
