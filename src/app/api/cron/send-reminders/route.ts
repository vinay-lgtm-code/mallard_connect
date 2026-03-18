import { NextRequest, NextResponse } from "next/server";
import { getFirestoreAdmin } from "@/lib/firebase/admin";
import { sendReminderEmail } from "@/lib/email/client";
import { Timestamp } from "firebase-admin/firestore";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getFirestoreAdmin();
  const today = new Date().toISOString().slice(0, 10);

  const tasksSnap = await db
    .collection("tasks")
    .where("dueDate", "<=", today)
    .where("status", "==", "pending")
    .where("reminderSent", "==", false)
    .get();

  let sent = 0;
  let errors = 0;

  await Promise.all(
    tasksSnap.docs.map(async (taskDoc) => {
      const task = taskDoc.data();
      const leadId: string = task.leadId;

      try {
        const leadDoc = await db.collection("leads").doc(leadId).get();
        if (!leadDoc.exists) return;

        const lead = leadDoc.data()!;
        const reminderEmails: string[] = Array.isArray(task.reminderEmails)
          ? task.reminderEmails.slice(0, 3)
          : [];

        if (reminderEmails.length === 0) return;

        await sendReminderEmail({
          to: reminderEmails,
          prospectName: lead.name ?? "Unknown",
          prospectPhone: lead.phone ?? "",
          followUpReason: task.followUpReason ?? "",
          reminderNote: task.note ?? "",
          leadUrl: `${APP_URL}/leads/${leadId}`,
        });

        await taskDoc.ref.update({ reminderSent: true });

        await db.collection("auditLog").add({
          type: "reminder_sent",
          taskId: taskDoc.id,
          leadId,
          recipients: reminderEmails,
          sentAt: Timestamp.now(),
        });

        sent++;
      } catch {
        errors++;
      }
    }),
  );

  return NextResponse.json({ sent, errors });
}
