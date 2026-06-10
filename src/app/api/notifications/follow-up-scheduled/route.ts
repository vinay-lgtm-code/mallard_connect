import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { sendFollowUpScheduledEmail } from "@/lib/email/client";

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

  // Verify a matching task was actually created by this user
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

  // Fetch lead (includes assigned_to), scheduler (auth.uid), and all managers in parallel
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

  const lead = leadRes.data as Record<string, unknown>;
  const scheduler = schedulerRes.data as Record<string, unknown>;
  const managers = (managersRes.data ?? []) as Array<Record<string, unknown>>;

  const leadName = `${lead.first_name ?? ""} ${lead.last_name ?? ""}`.trim();
  const schedulerName = (scheduler.full_name as string) ?? "";

  // Fetch assigned user's email if the lead has an assigned adviser
  let assignedUserEmail: string | null = null;
  if (lead.assigned_to) {
    const { data: assignedUser } = await supabase
      .from("users")
      .select("email")
      .eq("id", lead.assigned_to as string)
      .eq("tenant_id", auth.tenantId)
      .single();
    if (assignedUser) {
      assignedUserEmail = (assignedUser as Record<string, unknown>).email as string | null;
    }
  }

  // Build unique recipient list: assigned adviser + scheduler + all managers
  const recipientSet = new Set<string>();
  if (assignedUserEmail) recipientSet.add(assignedUserEmail);
  if (scheduler.email) recipientSet.add(scheduler.email as string);
  for (const m of managers) {
    if (m.email) recipientSet.add(m.email as string);
  }
  const recipients = Array.from(recipientSet);

  if (recipients.length === 0) {
    return NextResponse.json({ success: true, sent: 0 });
  }

  const appUrl = process.env.APP_URL ?? "https://app.sequence-ai.com";
  const leadUrl = `${appUrl}/leads/${leadId}`;

  await sendFollowUpScheduledEmail({
    to: recipients,
    leadName,
    taskTitle,
    dueDate,
    scheduledByName: schedulerName,
    leadUrl,
  });

  return NextResponse.json({ success: true, sent: recipients.length });
}
