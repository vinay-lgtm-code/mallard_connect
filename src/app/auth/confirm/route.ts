import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as "recovery" | "signup" | "email" | null;
  const next = searchParams.get("next");

  const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://sequence-ai.com";

  if (!tokenHash || !type) {
    return NextResponse.redirect(`${APP_URL}/login?error=invalid_link`);
  }

  // Sanitize redirect: must start with / and not // (open redirect protection)
  let redirectTo = "/dashboard";
  if (next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\")) {
    redirectTo = next;
  }

  const response = NextResponse.redirect(`${APP_URL}${redirectTo}`);
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });

  if (error) {
    return NextResponse.redirect(`${APP_URL}/login?error=invalid_link`);
  }

  return response;
}
