import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { sendReminderEmail } from "@/lib/email/client";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.sequence-ai.com";

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
  let errors = 0;
  const log: { taskId: string; recipients: string[]; ok: boolean; error?: string }[] = [];

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
      log.push({ taskId: task.id, recipients: reminderEmails, ok: true });
    } catch (err) {
      errors++;
      const msg = err instanceof Error ? err.message : String(err);
      log.push({ taskId: task.id, recipients: reminderEmails, ok: false, error: msg });
    }
  }

  return NextResponse.json({ sent, errors, totalDue: (tasks ?? []).length, log });
}

export const POST = GET;
