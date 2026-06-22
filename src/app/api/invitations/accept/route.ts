import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { hashInviteToken } from "@/lib/invitations";

function tokenHashFromRequest(request: NextRequest): string | null {
  const token = request.nextUrl.searchParams.get("token");
  return token ? hashInviteToken(token) : null;
}

export async function GET(request: NextRequest) {
  const tokenHash = tokenHashFromRequest(request);
  if (!tokenHash) return NextResponse.json({ error: "Missing token" }, { status: 400 });

  const supabase = createServiceClient();
  const { data: invite, error } = await supabase
    .from("team_invitations")
    .select("email, full_name, role, status, expires_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!invite) return NextResponse.json({ error: "Invitation not found" }, { status: 404 });

  if (invite.status !== "pending" || new Date(invite.expires_at).getTime() < Date.now()) {
    return NextResponse.json({ error: "Invitation is no longer active" }, { status: 410 });
  }

  return NextResponse.json({
    email: invite.email,
    fullName: invite.full_name,
    role: invite.role,
  });
}

export async function POST(request: NextRequest) {
  let body: { token?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.token || !body.password) {
    return NextResponse.json({ error: "token and password are required" }, { status: 400 });
  }
  if (body.password.length < 6) {
    return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
  }

  const tokenHash = hashInviteToken(body.token);
  const supabase = createServiceClient();
  const { data: invite, error: inviteErr } = await supabase
    .from("team_invitations")
    .select("*")
    .eq("token_hash", tokenHash)
    .eq("status", "pending")
    .maybeSingle();

  if (inviteErr) return NextResponse.json({ error: inviteErr.message }, { status: 500 });
  if (!invite) return NextResponse.json({ error: "Invitation not found" }, { status: 404 });

  if (new Date(invite.expires_at).getTime() < Date.now()) {
    await supabase
      .from("team_invitations")
      .update({ status: "expired" })
      .eq("id", invite.id);
    return NextResponse.json({ error: "Invitation has expired" }, { status: 410 });
  }

  const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
    email: invite.normalized_email,
    password: body.password,
    email_confirm: true,
    app_metadata: { role: invite.role, tenant_id: invite.tenant_id },
    user_metadata: { full_name: invite.full_name },
  });

  if (authErr || !authData.user) {
    return NextResponse.json({ error: authErr?.message ?? "Failed to create user" }, { status: 422 });
  }

  const uid = authData.user.id;
  const { error: userErr } = await supabase.from("users").insert({
    id: uid,
    tenant_id: invite.tenant_id,
    email: invite.normalized_email,
    full_name: invite.full_name,
    role: invite.role,
    is_active: true,
  });

  if (userErr) {
    await supabase.auth.admin.deleteUser(uid);
    return NextResponse.json({ error: userErr.message }, { status: 500 });
  }

  const { error: updateErr } = await supabase
    .from("team_invitations")
    .update({
      status: "accepted",
      accepted_by: uid,
      accepted_at: new Date().toISOString(),
    })
    .eq("id", invite.id)
    .eq("status", "pending");

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
