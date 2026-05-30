import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { Resend } from "resend";

type UserRole = "admin" | "manager" | "advisor";

async function verifyAdminOrManager(request: NextRequest) {
  const supabase = createServiceClient();
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return null;

  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) return null;

  const { data: profile } = await supabase
    .from("users")
    .select("role, tenant_id")
    .eq("id", user.id)
    .single();

  if (!profile) return null;
  const role = profile.role as UserRole;
  const tenantId = profile.tenant_id as string;
  if (role !== "admin" && role !== "manager") return null;

  return { uid: user.id, role, tenantId };
}

function generateTempPassword(): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let password = "";
  for (let i = 0; i < 12; i++) {
    password += chars[Math.floor(Math.random() * chars.length)];
  }
  return `${password}!1`;
}

export async function GET(request: NextRequest) {
  const caller = await verifyAdminOrManager(request);
  if (!caller) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const supabase = createServiceClient();
  const { data: users } = await supabase
    .from("users")
    .select("*")
    .eq("tenant_id", caller.tenantId)
    .order("created_at", { ascending: false });

  return NextResponse.json(users ?? []);
}

export async function POST(request: NextRequest) {
  const caller = await verifyAdminOrManager(request);
  if (!caller) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: { action?: string; email?: string; fullName?: string; role?: string };
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (body.action !== "invite") return NextResponse.json({ error: "Invalid action" }, { status: 400 });

  const { email, fullName, role } = body;
  if (!email || !fullName) {
    return NextResponse.json({ error: "email and fullName are required" }, { status: 400 });
  }

  const validRoles: UserRole[] = ["advisor", "manager"];
  const userRole: UserRole = validRoles.includes(role as UserRole) ? (role as UserRole) : "advisor";
  const tempPassword = generateTempPassword();

  const supabase = createServiceClient();

  const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
    app_metadata: { role: userRole, tenant_id: caller.tenantId },
    user_metadata: { full_name: fullName },
  });

  if (authErr || !authData.user) {
    return NextResponse.json({ error: authErr?.message ?? "Failed to create user" }, { status: 422 });
  }

  const uid = authData.user.id;

  await supabase.from("users").insert({
    id: uid,
    tenant_id: caller.tenantId,
    email,
    full_name: fullName,
    role: userRole,
    is_active: true,
  });

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.sequence-ai.com";
    await resend.emails.send({
      from: process.env.EMAIL_FROM ?? "Sequence <no-reply@sequence-ai.com>",
      to: [email],
      subject: "You've been invited to Sequence",
      html: `<p>Welcome, ${fullName}! You've been added as a <strong>${userRole}</strong>.</p>
<p>Email: <strong>${email}</strong><br/>Temporary password: <strong>${tempPassword}</strong></p>
<p><a href="${appUrl}/login">Log in to Sequence</a></p>
<p>Please change your password after logging in.</p>`,
    });
  } catch { /* email failure is non-fatal */ }

  return NextResponse.json({ id: uid, email, fullName, role: userRole }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const caller = await verifyAdminOrManager(request);
  if (!caller) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

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

  if (!target || target.tenant_id !== caller.tenantId) {
    return NextResponse.json({ error: "Cross-tenant update forbidden" }, { status: 403 });
  }

  const updates: Record<string, unknown> = {};

  if (role !== undefined) {
    const validRoles: UserRole[] = ["admin", "advisor", "manager"];
    if (!validRoles.includes(role as UserRole)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }
    updates.role = role;
    await supabase.auth.admin.updateUserById(userId, {
      app_metadata: { role, tenant_id: caller.tenantId },
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
