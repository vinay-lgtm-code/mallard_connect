import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { sendDailyDigestEmail } from "@/lib/email/client";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://sequence-ai.com";

function startOfWeek(d: Date): Date {
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day; // Monday = start
  const mon = new Date(d);
  mon.setDate(mon.getDate() + diff);
  mon.setHours(0, 0, 0, 0);
  return mon;
}

function endOfWeek(d: Date): Date {
  const sun = startOfWeek(d);
  sun.setDate(sun.getDate() + 6);
  sun.setHours(23, 59, 59, 999);
  return sun;
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatShortDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export async function GET(request: NextRequest) {
  // ── Auth ─────────────────────────────────────────────────────────────
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
  const now = new Date();
  const todayIso = now.toISOString();
  const mondayIso = startOfWeek(now).toISOString();
  const sundayIso = endOfWeek(now).toISOString();
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

  // ── 1. Get all active users with email ──────────────────────────────
  const { data: users, error: usersErr } = await supabase
    .from("users")
    .select("id, email, full_name, tenant_id")
    .eq("is_active", true)
    .neq("email", "");

  if (usersErr) {
    return NextResponse.json({ error: usersErr.message }, { status: 500 });
  }

  if (!users || users.length === 0) {
    return NextResponse.json({ sent: 0, skipped: 0, errors: 0, message: "No active users" });
  }

  let sent = 0;
  let skipped = 0;
  let errors = 0;
  const log: { userId: string; ok: boolean; reason?: string; error?: string }[] = [];

  for (const user of users) {
    try {
      // ── 2a/2b/2c. Parallel: overdue tasks, week tasks, recent leads ─
      const [{ data: overdueTasks }, { data: weekTasks }, { data: recentLeads }] = await Promise.all([
        supabase
          .from("tasks")
          .select("id, lead_id, title, due_date")
          .eq("tenant_id", user.tenant_id)
          .eq("assigned_to", user.id)
          .eq("status", "pending")
          .lt("due_date", todayIso),
        supabase
          .from("tasks")
          .select("id, lead_id, title, due_date")
          .eq("tenant_id", user.tenant_id)
          .eq("assigned_to", user.id)
          .eq("status", "pending")
          .gte("due_date", mondayIso)
          .lte("due_date", sundayIso),
        supabase
          .from("leads")
          .select("id, first_name, last_name, phone, mortgage_type, source, updated_at")
          .eq("tenant_id", user.tenant_id)
          .eq("assigned_to", user.id)
          .eq("status", "active")
          .gte("updated_at", twentyFourHoursAgo),
      ]);

      // Deduplicate week tasks that also appear in overdue
      const overdueLeadIds = new Set((overdueTasks ?? []).map((t) => t.lead_id));
      const filteredWeekTasks = (weekTasks ?? []).filter((t) => !overdueLeadIds.has(t.lead_id));

      const hasContent =
        (overdueTasks ?? []).length > 0 ||
        filteredWeekTasks.length > 0 ||
        (recentLeads ?? []).length > 0;

      if (!hasContent) {
        skipped++;
        log.push({ userId: user.id, ok: true, reason: "nothing to report" });
        continue;
      }

      // ── 3. Resolve lead data for task-based items ─────────────────
      const allTaskLeadIds = new Set<string>();
      for (const t of overdueTasks ?? []) if (t.lead_id) allTaskLeadIds.add(t.lead_id);
      for (const t of filteredWeekTasks) if (t.lead_id) allTaskLeadIds.add(t.lead_id);

      const leadMap = new Map<string, { first_name: string; last_name: string; phone: string; mortgage_type: string; source: string }>();

      if (allTaskLeadIds.size > 0) {
        const { data: leads } = await supabase
          .from("leads")
          .select("id, first_name, last_name, phone, mortgage_type, source")
          .in("id", Array.from(allTaskLeadIds));

        for (const l of leads ?? []) {
          leadMap.set(l.id, l);
        }
      }

      // ── 4. Build digest cards ─────────────────────────────────────
      function taskToCard(task: { lead_id: string; title: string; due_date: string | null }, isOverdue: boolean) {
        const lead = leadMap.get(task.lead_id);
        if (!lead) return null;
        return {
          id: task.lead_id,
          firstName: lead.first_name ?? "",
          lastName: lead.last_name ?? "",
          phone: lead.phone ?? "",
          mortgageType: lead.mortgage_type ?? "",
          source: lead.source ?? "",
          taskTitle: task.title ?? undefined,
          dueDate: task.due_date ? formatShortDate(task.due_date) : undefined,
          isOverdue,
        };
      }

      const overdueCards = (overdueTasks ?? [])
        .map((t) => taskToCard(t, true))
        .filter(Boolean) as NonNullable<ReturnType<typeof taskToCard>>[];

      const weekCards = filteredWeekTasks
        .map((t) => taskToCard(t, false))
        .filter(Boolean) as NonNullable<ReturnType<typeof taskToCard>>[];

      const recentCards = (recentLeads ?? []).map((l) => ({
        id: l.id,
        firstName: l.first_name ?? "",
        lastName: l.last_name ?? "",
        phone: l.phone ?? "",
        mortgageType: l.mortgage_type ?? "",
        source: l.source ?? "",
      }));

      // ── 5. Send ───────────────────────────────────────────────────
      await sendDailyDigestEmail({
        to: user.email,
        userName: user.full_name || "there",
        date: formatDate(now),
        overdue: overdueCards,
        dueThisWeek: weekCards,
        recentlyUpdated: recentCards,
        appUrl: APP_URL,
      });

      sent++;
      log.push({ userId: user.id, ok: true });
    } catch (err) {
      errors++;
      log.push({ userId: user.id, ok: false, error: err instanceof Error ? err.message : String(err) });
    }
  }

  return NextResponse.json({ sent, skipped, errors, totalUsers: users.length, log });
}

export const POST = GET;
