import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { sendLeadCreatedEmail } from "@/lib/email/client";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.sequence-ai.com";

async function verifyToken(request: NextRequest) {
  const supabase = createServiceClient();
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return null;

  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) return null;

  const { data: profile } = await supabase
    .from("users")
    .select("full_name, role, tenant_id")
    .eq("id", user.id)
    .single();

  return profile ? { uid: user.id, fullName: profile.full_name as string, role: profile.role as string, tenantId: profile.tenant_id as string } : null;
}

export async function POST(request: NextRequest) {
  const auth = await verifyToken(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { leadId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { leadId } = body;
  if (!leadId) {
    return NextResponse.json({ error: "leadId is required" }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { data: lead } = await supabase
    .from("leads")
    .select("first_name, last_name, phone, email, source, mortgage_type, readiness, assigned_to, created_at")
    .eq("id", leadId)
    .eq("tenant_id", auth.tenantId)
    .single();

  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

  // Only the user who created the lead (assigned_to at creation) can trigger this
  if (lead.assigned_to !== auth.uid) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Only send for leads created in the last 5 minutes to prevent re-firing
  const createdAt = new Date(lead.created_at).getTime();
  if (Date.now() - createdAt > 5 * 60 * 1000) {
    return NextResponse.json({ success: true, sent: 0, reason: "Lead is not recent" });
  }

  const { data: managers } = await supabase
    .from("users")
    .select("email")
    .eq("tenant_id", auth.tenantId)
    .in("role", ["admin", "manager"])
    .eq("is_active", true);

  const recipients = new Set<string>();
  for (const m of managers ?? []) {
    if (m.email) recipients.add(m.email as string);
  }

  if (recipients.size === 0) {
    return NextResponse.json({ success: true, sent: 0 });
  }

  const leadName = `${lead.first_name ?? ""} ${lead.last_name ?? ""}`.trim() || "Unknown";

  try {
    await sendLeadCreatedEmail({
      to: Array.from(recipients),
      leadName,
      leadPhone: lead.phone ?? "",
      leadEmail: lead.email ?? null,
      leadSource: lead.source ?? "other",
      mortgageType: lead.mortgage_type ?? null,
      readiness: lead.readiness ?? null,
      createdByName: auth.fullName,
      leadUrl: `${APP_URL}/leads/${leadId}`,
    });

    return NextResponse.json({ success: true, sent: recipients.size });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
