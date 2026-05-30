import { NextRequest, NextResponse } from "next/server";
import { parseSubdomain } from "@/lib/tenant";

const PUBLIC_PATHS = [
  "/login",
  "/signup",
  "/forgot-password",
  "/accept-invite",
  "/demo",
  "/onboarding",
];

function isPublic(pathname: string): boolean {
  if (pathname === "/") return true;
  // API routes handle their own auth — don't redirect them through /login.
  if (pathname.startsWith("/api/")) return true;
  for (const path of PUBLIC_PATHS) {
    if (pathname === path || pathname.startsWith(path + "/")) return true;
  }
  return false;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const host = request.headers.get("host");

  // Parse vanity subdomain (mallard.sequence-ai.com → "mallard").
  // Pass it to downstream pages/APIs as a header so they can resolve the tenantId
  // server-side via the `subdomains/{slug}` map.
  const subdomain = parseSubdomain(host);
  const requestHeaders = new Headers(request.headers);
  if (subdomain) {
    requestHeaders.set("x-sequence-tenant-slug", subdomain);
  }

  if (isPublic(pathname)) {
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  const session = request.cookies.get("__session");
  if (!session?.value) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.json|icons/|public/).*)"],
};
