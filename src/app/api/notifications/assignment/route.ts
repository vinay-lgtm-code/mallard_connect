import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { sendAssignmentEmail } from "@/lib/email/client";

async function verifyToken(request: NextRequest) {
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

  return profile ? { uid: user.id, role: profile.role as string, tenantId: profile.tenant_id as string } : null;
}

export async function POST(request: NextRequest) {
  const auth = await verifyToken(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { leadId?: string; assigneeId?: string; assignerId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { leadId, assigneeId, assignerId } = body;
  if (!leadId || !assigneeId || !assignerId) {
    return NextResponse.json({ error: "leadId, assigneeId, and assignerId are required" }, { status: 400 });
  }

  const supabase = createServiceClient();

  // Fetch lead, assignee, assigner, and all managers in parallel
  const [leadRes, assigneeRes, assignerRes, managersRes] = await Promise.all([
    supabase
      .from("leads")
      .select("first_name, last_name, phone, source, mortgage_type")
      .eq("id", leadId)
      .eq("tenant_id", auth.tenantId)
      .single(),
    supabase
      .from("users")
      .select("full_name, email")
      .eq("id", assigneeId)
      .eq("tenant_id", auth.tenantId)
      .single(),
    supabase
      .from("users")
      .select("full_name, email")
      .eq("id", assignerId)
      .eq("tenant_id", auth.tenantId)
      .single(),
    supabase
      .from("users")
      .select("email")
      .eq("tenant_id", auth.tenantId)
      .in("role", ["admin", "manager"])
      .eq("is_active", true),
  ]);

  if (!leadRes.data) return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  if (!assigneeRes.data) return NextResponse.json({ error: "Assignee not found" }, { status: 404 });
  if (!assignerRes.data) return NextResponse.json({ error: "Assigner not found" }, { status: 404 });

  const lead = leadRes.data as Record<string, unknown>;
  const assignee = assigneeRes.data as Record<string, unknown>;
  const assigner = assignerRes.data as Record<string, unknown>;
  const managers = (managersRes.data ?? []) as Array<Record<string, unknown>>;

  const leadName = `${lead.first_name ?? ""} ${lead.last_name ?? ""}`.trim();
  const assigneeName = (assignee.full_name as string) ?? "";
  const assignerName = (assigner.full_name as string) ?? "";

  // Build unique recipient list: assignee + all managers
  const recipientSet = new Set<string>();
  if (assignee.email) recipientSet.add(assignee.email as string);
  for (const m of managers) {
    if (m.email) recipientSet.add(m.email as string);
  }
  const recipients = Array.from(recipientSet);

  if (recipients.length === 0) {
    return NextResponse.json({ success: true, sent: 0 });
  }

  const appUrl = process.env.APP_URL ?? "https://app.sequence-ai.com";
  const leadUrl = `${appUrl}/leads/${leadId}`;

  await sendAssignmentEmail({
    to: recipients,
    leadName,
    leadPhone: (lead.phone as string) ?? "",
    leadSource: (lead.source as string) ?? "unknown",
    mortgageType: (lead.mortgage_type as string) ?? "not specified",
    assignedByName: assignerName,
    assigneeName,
    leadUrl,
  });

  return NextResponse.json({ success: true, sent: recipients.length });
}
