import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import {
  computeSnapshotMetrics,
  periodMonthFor,
  previousMonth,
  trailingMonths,
  type SnapshotLead,
} from "@/lib/analytics/compute";
import { requireCronAuth } from "@/lib/cron/auth";

// Nightly analytics snapshots.
//
// Two cron schedules hit this route (see vercel.json):
//   - daily   '0 3 * * *'   -> ?period=current   (rolling current-month-to-date)
//   - monthly '0 2 1 * *'   -> ?period=previous   (finalize the month that just ended)
//
// CRON_SECRET bearer token is required in production and enforced in any
// environment where CRON_SECRET is set.

const TENANT_PAGE_SIZE = 1000;
const LEAD_PAGE_SIZE = 1000;
// How many trailing months to seed best-effort snapshots for when no recorded
// snapshot row exists yet (so /reports has history going forward).
const BACKFILL_MONTHS = 6;

export async function GET(request: NextRequest) {
  const authError = requireCronAuth(request);
  if (authError) return authError;

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
  let backfilled = 0;
  let failed = 0;
  const log: {
    tenantId: string;
    ok: boolean;
    createdLeadCount?: number;
    backfilledMonths?: string[];
    error?: string;
  }[] = [];

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

      // Best-effort backfill: seed snapshots for any of the trailing
      // BACKFILL_MONTHS that have no recorded row yet, using the CURRENT leads.
      // These are reconstructions, not point-in-time recordings, but they give
      // /reports real history going forward instead of silent live recomputes.
      // The primary period (just upserted) is skipped.
      const backfillDates = trailingMonths(now, BACKFILL_MONTHS).filter(
        (d) => periodMonthFor(d) !== periodMonth
      );
      const candidateKeys = backfillDates.map((d) => periodMonthFor(d));

      const { data: existing, error: existErr } = await supabase
        .from("analytics_snapshots")
        .select("period_month")
        .eq("tenant_id", tenantId)
        .in("period_month", candidateKeys);
      if (existErr) throw existErr;
      const have = new Set((existing ?? []).map((r) => String(r.period_month).slice(0, 10)));

      const backfilledKeys: string[] = [];
      for (const d of backfillDates) {
        const key = periodMonthFor(d);
        if (have.has(key)) continue;
        const monthMetrics = computeSnapshotMetrics(leads, d);
        const { error: bfErr } = await supabase
          .from("analytics_snapshots")
          .upsert(
            { tenant_id: tenantId, period_month: key, metrics: monthMetrics },
            { onConflict: "tenant_id,period_month" }
          );
        if (bfErr) throw bfErr;
        backfilledKeys.push(key);
        backfilled++;
      }

      log.push({
        tenantId,
        ok: true,
        createdLeadCount: metrics.createdLeadCount,
        ...(backfilledKeys.length ? { backfilledMonths: backfilledKeys } : {}),
      });
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
    backfilled,
    failed,
    log,
  });
}

export const POST = GET;
