import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { sendDailyLeadsDigestEmail } from "@/lib/email/client";

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

  const { data: tenants } = await supabase.from("tenants").select("id, name");
  if (!tenants || tenants.length === 0) {
    return NextResponse.json({ sent: 0, message: "No tenants found" });
  }

  let totalSent = 0;
  let totalErrors = 0;
  const log: { tenantId: string; userId: string; leadCount: number; ok: boolean; error?: string }[] = [];

  for (const tenant of tenants) {
    const { data: users } = await supabase
      .from("users")
      .select("id, email, full_name")
      .eq("tenant_id", tenant.id)
      .eq("is_active", true);

    if (!users || users.length === 0) continue;

    const { data: stages } = await supabase
      .from("pipeline_stages")
      .select("id, name")
      .eq("tenant_id", tenant.id);

    const stageMap = new Map((stages ?? []).map((s) => [s.id, s.name]));

    for (const member of users) {
      const { data: leads } = await supabase
        .from("leads")
        .select("id, first_name, last_name, phone, current_stage_id, next_follow_up_date, readiness")
        .eq("tenant_id", tenant.id)
        .eq("assigned_to", member.id)
        .eq("status", "active")
        .order("next_follow_up_date", { ascending: true, nullsFirst: false });

      if (!leads || leads.length === 0) continue;

      const digestLeads = leads.map((l) => ({
        name: `${l.first_name ?? ""} ${l.last_name ?? ""}`.trim() || "Unknown",
        phone: l.phone ?? "",
        stage: stageMap.get(l.current_stage_id) ?? "Unknown",
        nextFollowUp: l.next_follow_up_date,
        readiness: l.readiness,
        leadUrl: `${APP_URL}/leads/${l.id}`,
      }));

      try {
        await sendDailyLeadsDigestEmail({
          to: member.email,
          recipientName: member.full_name,
          leads: digestLeads,
          appUrl: `${APP_URL}/dashboard`,
        });
        totalSent++;
        log.push({ tenantId: tenant.id, userId: member.id, leadCount: digestLeads.length, ok: true });
      } catch (err) {
        totalErrors++;
        const msg = err instanceof Error ? err.message : String(err);
        log.push({ tenantId: tenant.id, userId: member.id, leadCount: digestLeads.length, ok: false, error: msg });
      }
    }
  }

  return NextResponse.json({ sent: totalSent, errors: totalErrors, log });
}

export const POST = GET;
