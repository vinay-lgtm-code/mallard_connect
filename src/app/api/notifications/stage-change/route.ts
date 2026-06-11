import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { sendStageChangeEmail, sendLeadConvertedEmail } from "@/lib/email/client";
import { verifyToken, authError } from "@/lib/auth/verify-token";
import { getLeadName, getManagerEmails, filterRecipientsByPref } from "@/lib/email/recipients";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.sequence-ai.com";

export async function POST(request: NextRequest) {
  const result = await verifyToken(request);
  if (!result.ok) return authError(result);
  const { auth } = result;

  let body: { leadId?: string; toStageName?: string; note?: string; terminal?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { leadId, toStageName, note, terminal } = body;
  if (!leadId || !toStageName) {
    return NextResponse.json({ error: "leadId and toStageName are required" }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { data: lead } = await supabase
    .from("leads")
    .select("first_name, last_name, assigned_to, status")
    .eq("id", leadId)
    .eq("tenant_id", auth.tenantId)
    .single();

  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

  const leadName = getLeadName(lead);
  const leadUrl = `${APP_URL}/leads/${leadId}`;

  if (terminal) {
    const outcome = (lead.status === "converted" ? "converted" : "lost") as "converted" | "lost";
    const managerEmails = await getManagerEmails(supabase, auth.tenantId);
    if (managerEmails.length > 0) {
      try {
        await sendLeadConvertedEmail({ to: managerEmails, leadName, outcome, leadUrl });
      } catch { /* non-fatal */ }
    }
    return NextResponse.json({ success: true, sent: managerEmails.length, type: "terminal" });
  }

  // Non-terminal: adviser + managers filtered by stageChanges pref
  const recipientSet = new Set<string>();

  if (lead.assigned_to) {
    const { data: assignee } = await supabase
      .from("users")
      .select("email")
      .eq("id", lead.assigned_to as string)
      .eq("tenant_id", auth.tenantId)
      .single();
    if (assignee?.email) recipientSet.add(assignee.email as string);
  }

  const managerEmails = await getManagerEmails(supabase, auth.tenantId);
  for (const e of managerEmails) recipientSet.add(e);

  const filtered = await filterRecipientsByPref(
    supabase,
    auth.tenantId,
    Array.from(recipientSet),
    "stageChanges",
  );

  if (filtered.length === 0) {
    return NextResponse.json({ success: true, sent: 0 });
  }

  try {
    await sendStageChangeEmail({ to: filtered, leadName, toStageName, note: note ?? null, leadUrl });
    return NextResponse.json({ success: true, sent: filtered.length });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
