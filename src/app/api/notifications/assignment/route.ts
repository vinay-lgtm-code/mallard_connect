import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { sendAssignmentEmail } from "@/lib/email/client";
import { verifyToken, authError } from "@/lib/auth/verify-token";
import { getLeadName, filterRecipientsByPref } from "@/lib/email/recipients";

export async function POST(request: NextRequest) {
  const result = await verifyToken(request, { requireRole: ["admin", "manager"] });
  if (!result.ok) return authError(result);
  const { auth } = result;

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

  const leadRes = await supabase
    .from("leads")
    .select("first_name, last_name, phone, source, mortgage_type, assigned_to")
    .eq("id", leadId)
    .eq("tenant_id", auth.tenantId)
    .single();

  if (!leadRes.data) return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  const lead = leadRes.data;
  const assigneeId = lead.assigned_to as string | null;
  if (!assigneeId) return NextResponse.json({ error: "Lead has no assignee" }, { status: 400 });

  const [assigneeRes, assignerRes, managersRes] = await Promise.all([
    supabase
      .from("users")
      .select("full_name, email")
      .eq("id", assigneeId)
      .eq("tenant_id", auth.tenantId)
      .single(),
    supabase
      .from("users")
      .select("full_name, email")
      .eq("id", auth.uid)
      .eq("tenant_id", auth.tenantId)
      .single(),
    supabase
      .from("users")
      .select("email")
      .eq("tenant_id", auth.tenantId)
      .in("role", ["admin", "manager"])
      .eq("is_active", true),
  ]);

  if (!assigneeRes.data) return NextResponse.json({ error: "Assignee not found" }, { status: 404 });
  if (!assignerRes.data) return NextResponse.json({ error: "Assigner not found" }, { status: 404 });

  const assignee = assigneeRes.data;
  const assigner = assignerRes.data;
  const managers = managersRes.data ?? [];

  const leadName = getLeadName(lead);
  const assigneeName = (assignee.full_name as string) ?? "";
  const assignerName = (assigner.full_name as string) ?? "";

  const recipientSet = new Set<string>();
  if (assignee.email) recipientSet.add(assignee.email as string);
  for (const m of managers) {
    if (m.email) recipientSet.add(m.email as string);
  }

  const filtered = await filterRecipientsByPref(
    supabase,
    auth.tenantId,
    Array.from(recipientSet),
    "assignments",
  );

  if (filtered.length === 0) {
    return NextResponse.json({ success: true, sent: 0 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.sequence-ai.com";
  const leadUrl = `${appUrl}/leads/${leadId}`;

  try {
    await sendAssignmentEmail({
      to: filtered,
      leadName,
      leadPhone: (lead.phone as string) ?? "",
      leadSource: (lead.source as string) ?? "unknown",
      mortgageType: (lead.mortgage_type as string) ?? "not specified",
      assignedByName: assignerName,
      assigneeName,
      leadUrl,
    });

    return NextResponse.json({ success: true, sent: filtered.length });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
