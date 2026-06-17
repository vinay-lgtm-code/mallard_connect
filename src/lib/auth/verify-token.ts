import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { hasCapability, type RoleCapability } from "@/lib/auth/roles";
import type { UserRole } from "@/types";

export interface AuthResult {
  uid: string;
  role: string;
  tenantId: string;
  fullName: string;
  email: string;
}

type VerifySuccess = { ok: true; auth: AuthResult };
type VerifyFailure = { ok: false; status: 401 | 403; error: string };
type VerifyResult = VerifySuccess | VerifyFailure;

interface VerifyOptions {
  requireRole?: UserRole[];
  requireCapability?: RoleCapability;
}

export async function verifyToken(
  request: NextRequest,
  options?: VerifyOptions,
): Promise<VerifyResult> {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return { ok: false, status: 401, error: "Missing token" };

  const supabase = createServiceClient();
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) return { ok: false, status: 401, error: "Invalid token" };

  const { data: profile } = await supabase
    .from("users")
    .select("full_name, email, role, tenant_id")
    .eq("id", user.id)
    .single();

  if (!profile) return { ok: false, status: 401, error: "User profile not found" };

  const auth: AuthResult = {
    uid: user.id,
    role: profile.role as string,
    tenantId: profile.tenant_id as string,
    fullName: (profile.full_name as string) ?? "",
    email: (profile.email as string) ?? "",
  };

  if (options?.requireRole && !options.requireRole.includes(auth.role as UserRole)) {
    return { ok: false, status: 403, error: "Forbidden" };
  }

  if (options?.requireCapability && !hasCapability(auth.role, options.requireCapability)) {
    return { ok: false, status: 403, error: "Forbidden" };
  }

  return { ok: true, auth };
}

export function authError(result: VerifyFailure): NextResponse {
  return NextResponse.json({ error: result.error }, { status: result.status });
}
