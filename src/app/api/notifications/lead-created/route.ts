import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { sendLeadCreatedEmail } from "@/lib/email/client";
import { verifyToken, authError } from "@/lib/auth/verify-token";
import { getLeadName, getManagerEmails } from "@/lib/email/recipients";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://sequence-ai.com";

type LeadSourceRelation = { name?: string | null; slug?: string | null } | { name?: string | null; slug?: string | null }[] | null;

function getSourceLabel(source: LeadSourceRelation): string {
  const row = Array.isArray(source) ? source[0] : source;
  return row?.name ?? row?.slug ?? "Other";
}

function normalizeEmails(emails: unknown): string[] {
  if (!Array.isArray(emails)) return [];
  return emails
    .filter((email): email is string => typeof email === "string")
    .map((email) => email.trim())
    .filter(Boolean);
}

export async function POST(request: NextRequest) {
  const result = await verifyToken(request);
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

  const { data: lead } = await supabase
    .from("leads")
    .select("first_name, last_name, phone, email, source_id, lead_sources(name, slug), mortgage_type, readiness, assigned_to, created_at")
    .eq("id", leadId)
    .eq("tenant_id", auth.tenantId)
    .single();

  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

  if (lead.assigned_to !== auth.uid) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const createdAt = new Date(lead.created_at).getTime();
  if (Date.now() - createdAt > 5 * 60 * 1000) {
    return NextResponse.json({ success: true, sent: 0, reason: "Lead is not recent" });
  }

  const [{ data: reminderTasks }, managerRecipients] = await Promise.all([
    supabase
      .from("tasks")
      .select("reminder_emails")
      .eq("lead_id", leadId)
      .eq("tenant_id", auth.tenantId),
    getManagerEmails(supabase, auth.tenantId, "assignments"),
  ]);

  const reminderRecipients = (reminderTasks ?? []).flatMap((task) => normalizeEmails(task.reminder_emails));
  const recipients = [...new Set([auth.email, ...managerRecipients, ...reminderRecipients].filter(Boolean))];

  if (recipients.length === 0) {
    return NextResponse.json({ success: true, sent: 0 });
  }

  const leadName = getLeadName(lead);

  try {
    await sendLeadCreatedEmail({
      to: recipients,
      leadName,
      leadPhone: lead.phone ?? "",
      leadEmail: lead.email ?? null,
      leadSource: getSourceLabel(lead.lead_sources),
      mortgageType: lead.mortgage_type ?? null,
      readiness: lead.readiness ?? null,
      createdByName: auth.fullName,
      leadUrl: `${APP_URL}/leads/${leadId}`,
    });

    return NextResponse.json({ success: true, sent: recipients.length });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
