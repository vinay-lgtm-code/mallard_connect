// Shared analytics metric computation for historical snapshots.
//
// Months are treated as UTC business months. A "period" is the half-open
// UTC interval [periodStart, nextPeriodStart). period_month is stored as the
// first calendar day of that month (UTC).
//
// Metric definitions are explicit and period-scoped so stored snapshots stay
// stable even if the live reports UI changes later:
//   - createdLeadCount:   leads whose created_at falls inside the period
//   - convertedInPeriod:   leads whose converted_at falls inside the period
//   - totalLeads:          all leads for the tenant as of snapshot time
//   - convertedTotal:      all converted leads as of snapshot time
//   - conversionRate:      convertedTotal / totalLeads * 100 (1 dp), snapshot-time
//   - leadsByStage:        current_stage_id -> count, snapshot-time
//   - leadsBySource:       source_id -> count, snapshot-time
//   - perAdviser:          assigned_to -> { leadCount, convertedCount }, snapshot-time
//
// schemaVersion lets future metric changes be detected without ambiguity.

export const SNAPSHOT_SCHEMA_VERSION = 1;

export interface SnapshotLead {
  status: string | null;
  source_id: string | null;
  current_stage_id: string | null;
  assigned_to: string | null;
  created_at: string | null;
  converted_at: string | null;
}

export interface AdviserMetric {
  leadCount: number;
  convertedCount: number;
}

export interface SnapshotMetrics {
  schemaVersion: number;
  generatedAt: string;
  periodMonth: string; // YYYY-MM-DD (UTC, first of month)
  createdLeadCount: number;
  convertedInPeriod: number;
  totalLeads: number;
  convertedTotal: number;
  conversionRate: number;
  leadsByStage: Record<string, number>;
  leadsBySource: Record<string, number>;
  perAdviser: Record<string, AdviserMetric>;
}

/** First day of the given date's UTC month, as YYYY-MM-DD. */
export function periodMonthFor(date: Date): string {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth();
  return `${y}-${String(m + 1).padStart(2, "0")}-01`;
}

/** Half-open UTC bounds [start, end) for the month that contains `date`. */
export function monthBoundsUTC(date: Date): { start: Date; end: Date } {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth();
  const start = new Date(Date.UTC(y, m, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(y, m + 1, 1, 0, 0, 0, 0));
  return { start, end };
}

/** Returns the UTC month immediately before the one containing `date`. */
export function previousMonth(date: Date): Date {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth();
  return new Date(Date.UTC(y, m - 1, 1, 0, 0, 0, 0));
}

function inPeriod(ts: string | null, start: Date, end: Date): boolean {
  if (!ts) return false;
  const t = new Date(ts).getTime();
  if (Number.isNaN(t)) return false;
  return t >= start.getTime() && t < end.getTime();
}

/**
 * Compute snapshot metrics for `periodDate`'s UTC month.
 * `leads` should be all leads for a single tenant.
 */
export function computeSnapshotMetrics(leads: SnapshotLead[], periodDate: Date): SnapshotMetrics {
  const { start, end } = monthBoundsUTC(periodDate);

  let createdLeadCount = 0;
  let convertedInPeriod = 0;
  let convertedTotal = 0;
  const leadsByStage: Record<string, number> = {};
  const leadsBySource: Record<string, number> = {};
  const perAdviser: Record<string, AdviserMetric> = {};

  for (const lead of leads) {
    if (inPeriod(lead.created_at, start, end)) createdLeadCount++;
    if (inPeriod(lead.converted_at, start, end)) convertedInPeriod++;
    if (lead.status === "converted") convertedTotal++;

    const stage = lead.current_stage_id ?? "unknown";
    leadsByStage[stage] = (leadsByStage[stage] ?? 0) + 1;

    const source = lead.source_id ?? "other";
    leadsBySource[source] = (leadsBySource[source] ?? 0) + 1;

    const adviser = lead.assigned_to ?? "unassigned";
    if (!perAdviser[adviser]) perAdviser[adviser] = { leadCount: 0, convertedCount: 0 };
    perAdviser[adviser].leadCount++;
    if (lead.status === "converted") perAdviser[adviser].convertedCount++;
  }

  const totalLeads = leads.length;
  const conversionRate =
    totalLeads > 0 ? Math.round((convertedTotal / totalLeads) * 100 * 10) / 10 : 0;

  return {
    schemaVersion: SNAPSHOT_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    periodMonth: periodMonthFor(periodDate),
    createdLeadCount,
    convertedInPeriod,
    totalLeads,
    convertedTotal,
    conversionRate,
    leadsByStage,
    leadsBySource,
    perAdviser,
  };
}
