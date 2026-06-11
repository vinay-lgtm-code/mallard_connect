import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as "recovery" | "signup" | "email" | null;
  const next = searchParams.get("next");

  const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.sequence-ai.com";

  if (!tokenHash || !type) {
    return NextResponse.redirect(`${APP_URL}/login?error=invalid_link`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });

  if (error) {
    return NextResponse.redirect(`${APP_URL}/login?error=invalid_link`);
  }

  // Sanitize redirect: must start with / and not // (open redirect protection)
  let redirectTo = "/dashboard";
  if (next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\")) {
    redirectTo = next;
  }

  return NextResponse.redirect(`${APP_URL}${redirectTo}`);
}
