import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import {
  computeSnapshotMetrics,
  periodMonthFor,
  previousMonth,
  type SnapshotLead,
} from "@/lib/analytics/compute";

// Nightly analytics snapshots.
//
// Two cron schedules hit this route (see vercel.json):
//   - daily   '0 3 * * *'   -> ?period=current   (rolling current-month-to-date)
//   - monthly '0 2 1 * *'   -> ?period=previous   (finalize the month that just ended)
//
// Auth mirrors run-cadences: CRON_SECRET bearer token required in production,
// and enforced in any environment where CRON_SECRET is set.

const TENANT_PAGE_SIZE = 1000;
const LEAD_PAGE_SIZE = 1000;

function authorized(request: NextRequest): boolean {
  const auth = request.headers.get("authorization");
  if (process.env.NODE_ENV === "production") {
    return !!process.env.CRON_SECRET && auth === `Bearer ${process.env.CRON_SECRET}`;
  }
  if (process.env.CRON_SECRET) {
    return auth === `Bearer ${process.env.CRON_SECRET}`;
  }
  return true;
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const periodParam = request.nextUrl.searchParams.get("period") === "previous" ? "previous" : "current";
  const now = new Date();
  const periodDate = periodParam === "previous" ? previousMonth(now) : now;
  const periodMonth = periodMonthFor(periodDate);

  const supabase = createServiceClient();

  // Page through all tenants (service-role bypasses RLS).
  const tenantIds: string[] = [];
  for (let from = 0; ; from += TENANT_PAGE_SIZE) {
    const { data: tenants, error } = await supabase
      .from("tenants")
      .select("id")
      .range(from, from + TENANT_PAGE_SIZE - 1);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    for (const t of tenants ?? []) tenantIds.push(t.id as string);
    if (!tenants || tenants.length < TENANT_PAGE_SIZE) break;
  }

  let snapshotted = 0;
  let failed = 0;
  const log: { tenantId: string; ok: boolean; createdLeadCount?: number; error?: string }[] = [];

  for (const tenantId of tenantIds) {
    try {
      // Page through every lead for the tenant — Supabase caps a single
      // .select() at ~1000 rows, which would silently truncate metrics.
      const leads: SnapshotLead[] = [];
      for (let from = 0; ; from += LEAD_PAGE_SIZE) {
        const { data: page, error: leadsErr } = await supabase
          .from("leads")
          .select("status, source_id, current_stage_id, assigned_to, created_at, converted_at")
          .eq("tenant_id", tenantId)
          .range(from, from + LEAD_PAGE_SIZE - 1);
        if (leadsErr) throw leadsErr;
        for (const row of page ?? []) leads.push(row as SnapshotLead);
        if (!page || page.length < LEAD_PAGE_SIZE) break;
      }

      const metrics = computeSnapshotMetrics(leads, periodDate);

      const { error: upsertErr } = await supabase
        .from("analytics_snapshots")
        .upsert(
          { tenant_id: tenantId, period_month: periodMonth, metrics },
          { onConflict: "tenant_id,period_month" }
        );
      if (upsertErr) throw upsertErr;

      snapshotted++;
      log.push({ tenantId, ok: true, createdLeadCount: metrics.createdLeadCount });
    } catch (err) {
      failed++;
      const msg = err instanceof Error ? err.message : String(err);
      log.push({ tenantId, ok: false, error: msg });
    }
  }

  return NextResponse.json({
    period: periodParam,
    periodMonth,
    tenants: tenantIds.length,
    snapshotted,
    failed,
    log,
  });
}

export const POST = GET;
