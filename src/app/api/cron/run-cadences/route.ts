import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { sendReminderEmail } from "@/lib/email/client";
import { runDueCadenceSteps } from "@/lib/cadences/run";
import { isCadencesTemplatesEnabledServer } from "@/lib/feature-flags";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://sequence-ai.com";

export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    const auth = request.headers.get("authorization");
    if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  } else if (process.env.CRON_SECRET) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  // ── 1. Task reminders ────────────────────────────────────────────────
  const supabase = createServiceClient();
  const now = new Date().toISOString();

  const { data: tasks, error } = await supabase
    .from("tasks")
    .select("id, lead_id, tenant_id, title, description, reminder_emails, reminder_sent")
    .lte("due_date", now)
    .eq("status", "pending")
    .eq("reminder_sent", false);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let sent = 0;
  let reminderErrors = 0;
  const reminderLog: { taskId: string; recipients: string[]; ok: boolean; error?: string }[] = [];

  for (const task of tasks ?? []) {
    const reminderEmails = Array.isArray(task.reminder_emails)
      ? (task.reminder_emails as string[]).filter(Boolean).slice(0, 3)
      : [];

    if (!task.lead_id || reminderEmails.length === 0) continue;

    try {
      const { data: lead } = await supabase
        .from("leads")
        .select("first_name, last_name, phone, follow_up_reason, follow_up_notes")
        .eq("id", task.lead_id)
        .eq("tenant_id", task.tenant_id)
        .single();

      if (!lead) continue;

      const prospectName = `${lead.first_name ?? ""} ${lead.last_name ?? ""}`.trim();

      await sendReminderEmail({
        to: reminderEmails,
        prospectName: prospectName || "Unknown",
        prospectPhone: lead.phone ?? "",
        followUpReason: task.title ?? lead.follow_up_reason ?? "Follow-up due",
        reminderNote: task.description ?? lead.follow_up_notes ?? "",
        leadUrl: `${APP_URL}/leads/${task.lead_id}`,
      });

      await supabase.from("tasks").update({ reminder_sent: true }).eq("id", task.id);

      sent++;
      reminderLog.push({ taskId: task.id, recipients: reminderEmails, ok: true });
    } catch (err) {
      reminderErrors++;
      const msg = err instanceof Error ? err.message : String(err);
      reminderLog.push({ taskId: task.id, recipients: reminderEmails, ok: false, error: msg });
    }
  }

  // ── 2. Cadence steps ─────────────────────────────────────────────────
  let cadenceResult = { processed: 0, errors: 0, log: [] as unknown[] };
  if (isCadencesTemplatesEnabledServer()) {
    try {
      cadenceResult = await runDueCadenceSteps();
    } catch (err) {
      cadenceResult.errors = 1;
      cadenceResult.log = [{ error: err instanceof Error ? err.message : String(err) }];
    }
  } else {
    cadenceResult.log = [{ skipped: "cadences feature flag is off" }];
  }

  return NextResponse.json({
    reminders: { sent, errors: reminderErrors, totalDue: (tasks ?? []).length, log: reminderLog },
    cadences: cadenceResult,
  });
}

export const POST = GET;
