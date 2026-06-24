import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/server";
import { sendOAuthWelcomeEmail } from "@/lib/email/client";
import {
  findActiveProvisionByEmail,
  isProvisionedPocEmail,
} from "@/lib/provisioning/organization-provisions";

function safeRedirectPath(value: string | null, fallback: string) {
  if (
    value &&
    value.startsWith("/") &&
    !value.startsWith("//") &&
    !value.startsWith("/\\")
  ) {
    return value;
  }
  return fallback;
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeRedirectPath(searchParams.get("next"), "/dashboard");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user?.app_metadata?.tenant_id) {
        return NextResponse.redirect(new URL(next, origin));
      }

      if (!user?.email) {
        return NextResponse.redirect(new URL("/login?error=auth_callback_failed", origin));
      }

      const serviceSupabase = createServiceClient();
      const provision = await findActiveProvisionByEmail(serviceSupabase, user.email).catch((err) => {
        console.error("[auth/callback] provision lookup failed:", err);
        return null;
      });

      if (!provision || provision.status !== "provisioned" || !isProvisionedPocEmail(provision, user.email)) {
        await supabase.auth.signOut();
        return NextResponse.redirect(new URL("/signup?error=invite_required", origin));
      }

      // First-time OAuth signup — send welcome email (non-blocking)
      if (user.email && user.created_at) {
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
