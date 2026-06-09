import { NextRequest, NextResponse } from "next/server";
import { parseSubdomain } from "@/lib/tenant";
import { updateSession } from "@/lib/supabase/middleware";

const PUBLIC_PATHS = [
  "/login",
  "/signup",
  "/forgot-password",
  "/accept-invite",
  "/demo",
  "/onboarding",
  "/auth/callback",
];

function isPublic(pathname: string): boolean {
  if (pathname === "/") return true;
  if (pathname.startsWith("/api/")) return true;
  for (const path of PUBLIC_PATHS) {
    if (pathname === path || pathname.startsWith(path + "/")) return true;
  }
  return false;
}

function applySubdomain(
  response: NextResponse,
  subdomain: string | null
): NextResponse {
  if (subdomain) {
    response.headers.set("x-sequence-tenant-slug", subdomain);
  }
  return response;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const host = request.headers.get("host");
  const subdomain = parseSubdomain(host);

  // Public routes (marketing, login, signup, onboarding) must always render —
  // never block them on a Supabase round-trip. If the auth backend is down,
  // these pages still need to load so users can sign in once it recovers.
  if (isPublic(pathname)) {
    const requestHeaders = new Headers(request.headers);
    if (subdomain) {
      requestHeaders.set("x-sequence-tenant-slug", subdomain);
    }
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  // Demo mode: __session cookie is set by setDemoUser() — allow through.
  const demoSession = request.cookies.get("__session");
  if (demoSession?.value) {
    const requestHeaders = new Headers(request.headers);
    if (subdomain) {
      requestHeaders.set("x-sequence-tenant-slug", subdomain);
    }
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  // Supabase auth: refresh tokens and validate session.
  const { response, user } = await updateSession(request);

  if (!user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Authenticated but no tenant → needs onboarding.
  const tenantId = user.app_metadata?.tenant_id;
  if (!tenantId && !pathname.startsWith("/onboarding")) {
    return NextResponse.redirect(new URL("/onboarding", request.url));
  }

  return applySubdomain(response, subdomain);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.json|icons/|public/).*)",
  ],
};
