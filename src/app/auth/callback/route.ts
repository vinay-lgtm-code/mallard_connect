import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { createServerClient } from "@supabase/ssr";
import { sendOAuthWelcomeEmail } from "@/lib/email/client";
import {
  findActiveProvisionByEmail,
  isProvisionedPocEmail,
} from "@/lib/provisioning/organization-provisions";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const cookiesToApply: Parameters<NextResponse["cookies"]["set"]>[] = [];
  let cookieStore = request.cookies.getAll();

  function redirect(path: string) {
    const response = NextResponse.redirect(new URL(path, origin));
    cookiesToApply.forEach((cookie) => {
      response.cookies.set(...cookie);
    });
    return response;
  }

  if (code) {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore;
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore = cookieStore.filter((cookie) => cookie.name !== name);
              cookieStore.push({ name, value });
              cookiesToApply.push([name, value, options]);
            });
          },
        },
      }
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user?.app_metadata?.tenant_id) {
        return redirect("/dashboard");
      }

      if (!user?.email) {
        return redirect("/login?error=auth_callback_failed");
      }

      const serviceSupabase = createServiceClient();
      const provision = await findActiveProvisionByEmail(serviceSupabase, user.email).catch((err) => {
        console.error("[auth/callback] provision lookup failed:", err);
        return null;
      });

      if (!provision || provision.status !== "provisioned" || !isProvisionedPocEmail(provision, user.email)) {
        await supabase.auth.signOut();
        return redirect("/signup?error=invite_required");
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

      return redirect("/onboarding");
    }
  }

  return redirect("/login?error=auth_callback_failed");
}
