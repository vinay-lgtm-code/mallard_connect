import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { sendFollowUpScheduledEmail } from "@/lib/email/client";
import { verifyToken, authError } from "@/lib/auth/verify-token";
import { getLeadName, filterRecipientsByPref } from "@/lib/email/recipients";

export async function POST(request: NextRequest) {
  const result = await verifyToken(request);
  if (!result.ok) return authError(result);
  const { auth } = result;

  let body: { leadId?: string; taskTitle?: string; dueDate?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { leadId, taskTitle, dueDate } = body;
  if (!leadId || !taskTitle || !dueDate) {
    return NextResponse.json({ error: "leadId, taskTitle, and dueDate are required" }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { data: task } = await supabase
    .from("tasks")
    .select("id")
    .eq("lead_id", leadId)
    .eq("created_by", auth.uid)
    .eq("tenant_id", auth.tenantId)
    .eq("title", taskTitle)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (!task) {
    return NextResponse.json({ error: "No matching task found" }, { status: 404 });
  }

  const [leadRes, schedulerRes, managersRes] = await Promise.all([
    supabase
      .from("leads")
      .select("first_name, last_name, assigned_to")
      .eq("id", leadId)
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

  if (!leadRes.data) return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  if (!schedulerRes.data) return NextResponse.json({ error: "Scheduler user not found" }, { status: 404 });

  const lead = leadRes.data;
  const scheduler = schedulerRes.data;
  const managers = managersRes.data ?? [];

  const leadName = getLeadName(lead);
  const schedulerName = (scheduler.full_name as string) ?? "";

  let assignedUserEmail: string | null = null;
  if (lead.assigned_to) {
    const { data: assignedUser } = await supabase
      .from("users")
      .select("email")
      .eq("id", lead.assigned_to as string)
      .eq("tenant_id", auth.tenantId)
      .single();
    if (assignedUser) {
      assignedUserEmail = assignedUser.email as string | null;
    }
  }

  const recipientSet = new Set<string>();
  if (assignedUserEmail) recipientSet.add(assignedUserEmail);
  if (scheduler.email) recipientSet.add(scheduler.email as string);
  for (const m of managers) {
    if (m.email) recipientSet.add(m.email as string);
  }

  const filtered = await filterRecipientsByPref(
    supabase,
    auth.tenantId,
    Array.from(recipientSet),
    "reminders",
  );

  if (filtered.length === 0) {
    return NextResponse.json({ success: true, sent: 0 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.sequence-ai.com";
  const leadUrl = `${appUrl}/leads/${leadId}`;

  await sendFollowUpScheduledEmail({
    to: filtered,
    leadName,
    taskTitle,
    dueDate,
    scheduledByName: schedulerName,
    leadUrl,
  });

  return NextResponse.json({ success: true, sent: filtered.length });
}
