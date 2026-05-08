import { NextRequest, NextResponse } from "next/server";
import { getFirestoreAdmin } from "@/lib/firebase/admin";
import { sendReminderEmail } from "@/lib/email/client";
import { Timestamp } from "firebase-admin/firestore";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.sequence-ai.com";

/**
 * Daily reminder + cadence runner.
 *
 * Finds tasks across both production (`tenants/{tid}/tasks`) and demo
 * (`demoTenants/{slug}/tasks`) namespaces using a collection-group query,
 * filters to those due now with status pending and no reminder yet sent,
 * and emails each one's reminderEmails recipients via Resend.
 *
 * Authorisation: in production we require `Authorization: Bearer ${CRON_SECRET}`.
 * In development the check is skipped so you can curl-test the demo flow.
 */
export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    const auth = request.headers.get("authorization");
    if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  } else if (process.env.CRON_SECRET) {
    // If a CRON_SECRET is configured locally, still enforce it.
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const db = getFirestoreAdmin();
  const now = Timestamp.now();

  const tasksSnap = await db
    .collectionGroup("tasks")
    .where("dueDate", "<=", now)
    .where("status", "==", "pending")
    .where("reminderSent", "==", false)
    .get();

  let sent = 0;
  let errors = 0;
  const log: { taskId: string; recipients: string[]; ok: boolean; error?: string }[] = [];

  await Promise.all(
    tasksSnap.docs.map(async (taskDoc) => {
      const task = taskDoc.data() as Record<string, unknown>;
      const leadId = task.leadId as string | undefined;
      const reminderEmails = Array.isArray(task.reminderEmails)
        ? (task.reminderEmails as string[]).filter(Boolean).slice(0, 3)
        : [];

      if (!leadId || reminderEmails.length === 0) return;

      // tenants/{tid}/tasks/{id} or demoTenants/{slug}/tasks/{id}
      // → parent of taskDoc.ref is the "tasks" collection
      // → its parent is the tenant root doc
      const tenantRoot = taskDoc.ref.parent.parent;
      if (!tenantRoot) return;

      try {
        const leadDoc = await tenantRoot.collection("leads").doc(leadId).get();
        if (!leadDoc.exists) return;
        const lead = leadDoc.data() as Record<string, unknown>;

        const prospectName = `${(lead.firstName as string) ?? ""} ${(lead.lastName as string) ?? ""}`.trim();

        await sendReminderEmail({
          to: reminderEmails,
          prospectName: prospectName || "Unknown",
          prospectPhone: (lead.phone as string) ?? "",
          followUpReason:
            (task.title as string) ?? (lead.followUpReason as string) ?? "Follow-up due",
          reminderNote: (task.description as string) ?? (lead.followUpNotes as string) ?? "",
          leadUrl: `${APP_URL}/leads/${leadId}`,
        });

        await taskDoc.ref.update({ reminderSent: true });

        await tenantRoot.collection("auditLog").add({
          type: "reminder_sent",
          taskId: taskDoc.id,
          leadId,
          recipients: reminderEmails,
          sentAt: Timestamp.now(),
        });

        sent++;
        log.push({ taskId: taskDoc.id, recipients: reminderEmails, ok: true });
      } catch (err) {
        errors++;
        const msg = err instanceof Error ? err.message : String(err);
        log.push({ taskId: taskDoc.id, recipients: reminderEmails, ok: false, error: msg });
      }
    }),
  );

  return NextResponse.json({ sent, errors, totalDue: tasksSnap.size, log });
}

// Convenience: also accept POST with the same handler so curl -X POST works.
export const POST = GET;
