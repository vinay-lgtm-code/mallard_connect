import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { sendLeadAssignmentEmail } from "@/lib/email/client";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.sequence-ai.com";

export async function POST(request: NextRequest) {
  const supabase = createServiceClient();

  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { leadId?: string; assigneeId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { leadId, assigneeId } = body;
  if (!leadId || !assigneeId) {
    return NextResponse.json({ error: "leadId and assigneeId are required" }, { status: 400 });
  }

  const { data: callerProfile } = await supabase
    .from("users")
    .select("tenant_id, full_name, email, role")
    .eq("id", user.id)
    .single();

  if (!callerProfile) {
    return NextResponse.json({ error: "Caller profile not found" }, { status: 404 });
  }

  if (!["admin", "manager"].includes(callerProfile.role)) {
    return NextResponse.json({ error: "Only managers and admins can trigger assignment notifications" }, { status: 403 });
  }

  const { data: assignee } = await supabase
    .from("users")
    .select("full_name, email, tenant_id")
    .eq("id", assigneeId)
    .single();

  if (!assignee || assignee.tenant_id !== callerProfile.tenant_id) {
    return NextResponse.json({ error: "Assignee not found" }, { status: 404 });
  }

  const { data: lead } = await supabase
    .from("leads")
    .select("first_name, last_name, phone, email, source, mortgage_type, readiness, property_value, current_stage_id, tenant_id, assigned_to")
    .eq("id", leadId)
    .single();

  if (!lead || lead.tenant_id !== callerProfile.tenant_id) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  if (lead.assigned_to !== assigneeId) {
    return NextResponse.json({ error: "Lead is not assigned to this user" }, { status: 409 });
  }

  let stageName = "Unknown";
  if (lead.current_stage_id) {
    const { data: stage } = await supabase
      .from("pipeline_stages")
      .select("name")
      .eq("id", lead.current_stage_id)
      .single();
    if (stage) stageName = stage.name;
  }

  const leadName = `${lead.first_name ?? ""} ${lead.last_name ?? ""}`.trim() || "Unknown";

  const recipients = new Set<string>();
  if (assignee.email) recipients.add(assignee.email);
  if (callerProfile.email && callerProfile.email !== assignee.email) {
    recipients.add(callerProfile.email);
  }

  if (recipients.size === 0) {
    return NextResponse.json({ sent: false, reason: "No recipient emails" });
  }

  try {
    await sendLeadAssignmentEmail({
      to: Array.from(recipients),
      assigneeName: assignee.full_name,
      assignerName: callerProfile.full_name,
      lead: {
        name: leadName,
        phone: lead.phone ?? "",
        email: lead.email,
        source: lead.source ?? "other",
        mortgageType: lead.mortgage_type,
        readiness: lead.readiness,
        propertyValue: lead.property_value,
        stage: stageName,
      },
      leadUrl: `${APP_URL}/leads/${leadId}`,
    });

    return NextResponse.json({ sent: true, recipients: Array.from(recipients) });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ sent: false, error: msg }, { status: 500 });
  }
}
