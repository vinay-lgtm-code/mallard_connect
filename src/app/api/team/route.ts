import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { sendTeamInviteEmail } from "@/lib/email/client";
import { verifyToken, authError } from "@/lib/auth/verify-token";
import { createInviteToken, inviteExpiry } from "@/lib/invitations";
import { normalizeEmail } from "@/lib/provisioning/domains";

type UserRole = "admin" | "manager" | "advisor" | "case_manager";

export async function GET(request: NextRequest) {
  const result = await verifyToken(request, { requireRole: ["admin", "manager"] });
  if (!result.ok) return authError(result);
  const { auth } = result;

  const supabase = createServiceClient();
  const { data: users } = await supabase
    .from("users")
    .select("*")
    .eq("tenant_id", auth.tenantId)
    .order("created_at", { ascending: false });

  return NextResponse.json(users ?? []);
}

export async function POST(request: NextRequest) {
  const result = await verifyToken(request, { requireRole: ["admin", "manager"] });
  if (!result.ok) return authError(result);
  const { auth } = result;

  let body: { action?: string; email?: string; fullName?: string; role?: string };
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (body.action !== "invite") return NextResponse.json({ error: "Invalid action" }, { status: 400 });

  const { email, fullName, role } = body;
  if (!email || !fullName) {
    return NextResponse.json({ error: "email and fullName are required" }, { status: 400 });
  }

  const validRoles: UserRole[] = ["advisor", "manager", "case_manager"];
  const userRole: UserRole = validRoles.includes(role as UserRole) ? (role as UserRole) : "advisor";
  const normalizedEmail = normalizeEmail(email);

  const supabase = createServiceClient();

  const { data: existingUser } = await supabase
    .from("users")
    .select("id")
    .eq("tenant_id", auth.tenantId)
    .eq("email", normalizedEmail)
    .maybeSingle();

  if (existingUser) {
    return NextResponse.json({ error: "That user is already on this team" }, { status: 409 });
  }

  const { token, tokenHash } = createInviteToken();
  const { data: invite, error: inviteErr } = await supabase.from("team_invitations").insert({
    tenant_id: auth.tenantId,
    email: email.trim(),
    normalized_email: normalizedEmail,
    full_name: fullName,
    role: userRole,
    token_hash: tokenHash,
    expires_at: inviteExpiry(),
    invited_by: auth.uid,
  }).select("id").single();

  if (inviteErr || !invite) {
    const status = inviteErr?.code === "23505" ? 409 : 422;
    return NextResponse.json({ error: inviteErr?.message ?? "Failed to create invite" }, { status });
  }

  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://sequence-ai.com";
    await sendTeamInviteEmail({
      to: normalizedEmail,
      fullName,
      role: userRole,
      inviteUrl: `${appUrl}/accept-invite?token=${encodeURIComponent(token)}`,
    });
  } catch { /* email failure is non-fatal */ }

  return NextResponse.json({ id: invite.id, email: normalizedEmail, fullName, role: userRole }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const result = await verifyToken(request, { requireRole: ["admin", "manager"] });
  if (!result.ok) return authError(result);
  const { auth } = result;

  let body: { userId?: string; role?: string; isActive?: boolean };
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { userId, role, isActive } = body;
  if (!userId) return NextResponse.json({ error: "userId is required" }, { status: 400 });

  const supabase = createServiceClient();

  const { data: target } = await supabase
    .from("users")
    .select("tenant_id")
    .eq("id", userId)
    .single();

  if (!target || target.tenant_id !== auth.tenantId) {
    return NextResponse.json({ error: "Cross-tenant update forbidden" }, { status: 403 });
  }

  const updates: Record<string, unknown> = {};

  if (role !== undefined) {
    const validRoles: UserRole[] = ["admin", "advisor", "manager", "case_manager"];
    if (!validRoles.includes(role as UserRole)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }
    updates.role = role;
    await supabase.auth.admin.updateUserById(userId, {
      app_metadata: { role, tenant_id: auth.tenantId },
    });
  }

  if (isActive !== undefined) {
    updates.is_active = isActive;
    await supabase.auth.admin.updateUserById(userId, {
      ban_duration: isActive ? "none" : "876000h",
    });
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  await supabase.from("users").update(updates).eq("id", userId);

  return NextResponse.json({ success: true, userId, ...updates });
}

export async function DELETE(request: NextRequest) {
  const result = await verifyToken(request, { requireRole: ["admin", "manager"] });
  if (!result.ok) return authError(result);
  const { auth } = result;

  let body: { userId?: string };
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { userId } = body;
  if (!userId) return NextResponse.json({ error: "userId is required" }, { status: 400 });

  if (userId === auth.uid) {
    return NextResponse.json({ error: "Cannot remove yourself" }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { data: target } = await supabase
    .from("users")
    .select("tenant_id, role")
    .eq("id", userId)
    .single();

  if (!target || target.tenant_id !== auth.tenantId) {
    return NextResponse.json({ error: "Cross-tenant delete forbidden" }, { status: 403 });
  }

  if (target.role === "admin") {
    return NextResponse.json({ error: "Cannot remove an admin user" }, { status: 403 });
  }

  try {
    await supabase.from("leads").update({ assigned_to: null }).eq("assigned_to", userId).eq("tenant_id", auth.tenantId);
    await supabase.from("tasks").update({ assigned_to: null }).eq("assigned_to", userId).eq("tenant_id", auth.tenantId);
    await supabase.from("tasks").update({ created_by: null }).eq("created_by", userId).eq("tenant_id", auth.tenantId);
    await supabase.from("activities").update({ performed_by: null }).eq("performed_by", userId).eq("tenant_id", auth.tenantId);
    await supabase.from("notifications").delete().eq("user_id", userId).eq("tenant_id", auth.tenantId);
    await supabase.from("import_records").delete().eq("uploaded_by", userId).eq("tenant_id", auth.tenantId);

    await supabase.from("users").delete().eq("id", userId).eq("tenant_id", auth.tenantId);

    const { error: deleteErr } = await supabase.auth.admin.deleteUser(userId);
    if (deleteErr) throw deleteErr;

    return NextResponse.json({ success: true, userId });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to remove user";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
