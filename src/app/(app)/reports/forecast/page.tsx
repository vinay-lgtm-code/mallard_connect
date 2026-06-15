"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useLeads, useTenantUsers } from "@/hooks/use-leads";
import { formatCurrency } from "@/lib/utils";
import type { Lead, User } from "@/types";
import { Wallet, Scale, Target, CalendarClock } from "lucide-react";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Parse a date that may be a Supabase `DATE` string (YYYY-MM-DD) as a LOCAL
 * date. `new Date("2026-07-01")` parses as UTC midnight which, in negative-offset
 * timezones, lands in the previous month and skews the month buckets. Returns
 * null for missing / invalid values so we never produce a "NaN-NaN" bucket.
 */
function parseLocalDate(ts: unknown): Date | null {
  if (!ts) return null;
  if (ts instanceof Date) return Number.isNaN(ts.getTime()) ? null : ts;
  if (typeof ts === "string") {
    const dateOnly = /^(\d{4})-(\d{2})-(\d{2})/.exec(ts);
    if (dateOnly) {
      const [, y, m, d] = dateOnly;
      const dt = new Date(Number(y), Number(m) - 1, Number(d));
      return Number.isNaN(dt.getTime()) ? null : dt;
    }
    const dt = new Date(ts);
    return Number.isNaN(dt.getTime()) ? null : dt;
  }
  return null;
}

function getMonthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function getMonthLabel(date: Date): string {
  return date.toLocaleString("default", { month: "short", year: "numeric" });
}

/** Confidence as a 0–1 weight, clamped. Null / malformed values treated as 0. */
function confidenceWeight(confidence: number | null): number {
  if (confidence == null || Number.isNaN(confidence)) return 0;
  return Math.min(Math.max(confidence, 0), 100) / 100;
}

function dealValueOf(lead: Lead): number {
  const v = lead.dealValue;
  if (v == null || Number.isNaN(v)) return 0;
  return v;
}

// ─── KPI Card (mirrors reports/page.tsx) ────────────────────────────────────────

function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  color,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  color?: string;
}) {
  return (
    <div className="bg-white rounded-[12px] p-5 shadow-sm border border-gray-100">
      <div className="flex items-start justify-between gap-2 mb-3">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-gray-100 text-gray-400">
          <Icon size={16} />
        </div>
      </div>
      <p className="text-3xl font-bold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

// ─── Types ──────────────────────────────────────────────────────────────────

interface MonthRow {
  key: string;
  label: string;
  isPast: boolean;
  dealCount: number;
  total: number;
  weighted: number;
  expected: number;
}

interface AdviserRow {
  userId: string;
  name: string;
  dealCount: number;
  total: number;
  weighted: number;
  expected: number;
}

// ─── Monthly forecast table ──────────────────────────────────────────────────

function MonthlyForecastTable({
  rows,
  maxWeighted,
}: {
  rows: MonthRow[];
  maxWeighted: number;
}) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-gray-400 text-center py-8">
        No deals with an estimated close date yet. Add deal value, confidence and an
        estimated close date to a lead to see it forecast here.
      </p>
    );
  }
  return (
    <div className="overflow-x-auto -mx-1">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-gray-500 border-b border-gray-100">
            <th className="text-left py-2.5 px-1 font-medium">Month</th>
            <th className="text-right py-2.5 px-1 font-medium">Deals</th>
            <th className="text-right py-2.5 px-1 font-medium">Total value</th>
            <th className="text-right py-2.5 px-1 font-medium">Weighted</th>
            <th className="text-right py-2.5 px-1 font-medium">Expected close</th>
            <th className="text-left py-2.5 px-1 font-medium w-32">Weighted share</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {rows.map((row) => {
            const pct = maxWeighted > 0 ? (row.weighted / maxWeighted) * 100 : 0;
            return (
              <tr key={row.key} className="group hover:bg-gray-50">
                <td className="py-3 px-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">{row.label}</span>
                    {row.isPast && (
                      <span
                        className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-semibold"
                        title="Estimated close date is in the past"
                      >
                        Overdue
                      </span>
                    )}
                  </div>
                </td>
                <td className="py-3 px-1 text-right text-gray-700">{row.dealCount}</td>
                <td className="py-3 px-1 text-right text-gray-700">
                  {formatCurrency(Math.round(row.total))}
                </td>
                <td className="py-3 px-1 text-right font-semibold text-gray-900">
                  {formatCurrency(Math.round(row.weighted))}
                </td>
                <td className="py-3 px-1 text-right text-success font-semibold">
                  {formatCurrency(Math.round(row.expected))}
                </td>
                <td className="py-3 px-1">
                  <div className="bg-gray-100 rounded-full h-2 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-500"
                      style={{ width: `${Math.max(pct, row.weighted > 0 ? 4 : 0)}%` }}
                    />
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Per-adviser table ──────────────────────────────────────────────────────

function AdviserForecastTable({ rows }: { rows: AdviserRow[] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-gray-400 text-center py-4">No forecast data.</p>;
  }
  return (
    <div className="overflow-x-auto -mx-1">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-gray-500 border-b border-gray-100">
            <th className="text-left py-2.5 px-1 font-medium">Advisor</th>
            <th className="text-right py-2.5 px-1 font-medium">Deals</th>
            <th className="text-right py-2.5 px-1 font-medium">Total value</th>
            <th className="text-right py-2.5 px-1 font-medium">Weighted</th>
            <th className="text-right py-2.5 px-1 font-medium">Expected close</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {rows.map((row, i) => (
            <tr key={row.userId} className="group hover:bg-gray-50">
              <td className="py-3 px-1">
                <div className="flex items-center gap-2.5">
                  <span className="text-xs text-gray-400 w-4 flex-shrink-0">{i + 1}</span>
                  <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-xs font-bold">
                      {row.name
                        .split(" ")
                        .map((p) => p[0])
                        .join("")
                        .toUpperCase()
                        .slice(0, 2)}
                    </span>
                  </div>
                  <span className="font-medium text-gray-900 text-sm">{row.name}</span>
                </div>
              </td>
              <td className="py-3 px-1 text-right text-gray-700">{row.dealCount}</td>
              <td className="py-3 px-1 text-right text-gray-700">
                {formatCurrency(Math.round(row.total))}
              </td>
              <td className="py-3 px-1 text-right font-semibold text-gray-900">
                {formatCurrency(Math.round(row.weighted))}
              </td>
              <td className="py-3 px-1 text-right text-success font-semibold">
                {formatCurrency(Math.round(row.expected))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ForecastPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const { leads, loading: leadsLoading } = useLeads();
  const { users, loading: usersLoading } = useTenantUsers();

  useEffect(() => {
    if (!loading && !user) router.push("/login");
    if (!loading && user && user.role === "advisor") router.push("/dashboard");
  }, [user, loading, router]);

  const forecast = useMemo(() => {
    const empty = {
      conversionRate: 0,
      convertedLeads: 0,
      totalLeads: 0,
      grandTotal: 0,
      grandWeighted: 0,
      grandExpected: 0,
      forecastDealCount: 0,
      monthRows: [] as MonthRow[],
      adviserRows: [] as AdviserRow[],
    };
    if (!leads || leads.length === 0) return empty;

    // Historical conversion rate is computed across ALL leads, BEFORE any
    // forecast filtering (otherwise `converted` would always be 0).
    const totalLeads = leads.length;
    const convertedLeads = leads.filter((l) => l.status === "converted").length;
    const conversionRate = totalLeads > 0 ? convertedLeads / totalLeads : 0;

    // Forecast pool: leads still in play (not converted, not lost) that have a
    // parseable estimated close date.
    const forecastLeads = leads.filter((l) => {
      if (l.status === "converted" || l.status === "lost") return false;
      return parseLocalDate(l.estimatedCloseDate) !== null;
    });

    const now = new Date();
    const currentMonthKey = getMonthKey(now);

    // ── By month ──
    const monthMap = new Map<
      string,
      { label: string; date: Date; dealCount: number; total: number; weighted: number }
    >();
    for (const lead of forecastLeads) {
      const date = parseLocalDate(lead.estimatedCloseDate)!;
      const key = getMonthKey(date);
      const entry =
        monthMap.get(key) ??
        { label: getMonthLabel(date), date, dealCount: 0, total: 0, weighted: 0 };
      entry.dealCount += 1;
      entry.total += dealValueOf(lead);
      entry.weighted += dealValueOf(lead) * confidenceWeight(lead.confidence);
      monthMap.set(key, entry);
    }
    const monthRows: MonthRow[] = Array.from(monthMap.entries())
      .map(([key, e]) => ({
        key,
        label: e.label,
        isPast: key < currentMonthKey,
        dealCount: e.dealCount,
        total: e.total,
        weighted: e.weighted,
        expected: e.weighted * conversionRate,
      }))
      .sort((a, b) => a.key.localeCompare(b.key));

    // ── By adviser ── keyed off the lead's assignedTo so unknown / inactive /
    // unassigned advisers still surface their pipeline value.
    const userNames = new Map<string, string>();
    for (const u of (users ?? []) as (User & { id: string })[]) {
      userNames.set(u.id, u.fullName);
    }
    const adviserMap = new Map<
      string,
      { name: string; dealCount: number; total: number; weighted: number }
    >();
    for (const lead of forecastLeads) {
      const id = lead.assignedTo || "__unassigned__";
      const name = lead.assignedTo
        ? userNames.get(lead.assignedTo) ?? "Unknown advisor"
        : "Unassigned";
      const entry =
        adviserMap.get(id) ?? { name, dealCount: 0, total: 0, weighted: 0 };
      entry.dealCount += 1;
      entry.total += dealValueOf(lead);
      entry.weighted += dealValueOf(lead) * confidenceWeight(lead.confidence);
      adviserMap.set(id, entry);
    }
    const adviserRows: AdviserRow[] = Array.from(adviserMap.entries())
      .map(([userId, e]) => ({
        userId,
        name: e.name,
        dealCount: e.dealCount,
        total: e.total,
        weighted: e.weighted,
        expected: e.weighted * conversionRate,
      }))
      .sort((a, b) => b.weighted - a.weighted);

    const grandTotal = monthRows.reduce((s, r) => s + r.total, 0);
    const grandWeighted = monthRows.reduce((s, r) => s + r.weighted, 0);
    const grandExpected = monthRows.reduce((s, r) => s + r.expected, 0);
    const forecastDealCount = forecastLeads.length;

    return {
      conversionRate,
      convertedLeads,
      totalLeads,
      grandTotal,
      grandWeighted,
      grandExpected,
      forecastDealCount,
      monthRows,
      adviserRows,
    };
  }, [leads, users]);

  if (loading || !user) {
    return (
      <div className="flex justify-center py-16">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (user.role === "advisor") return null;

  const isLoading = leadsLoading || usersLoading;
  const maxWeighted = Math.max(...forecast.monthRows.map((r) => r.weighted), 0);

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div>
        <p className="text-sm text-gray-500">
          Expected closings by month, weighted by deal confidence and your historical
          conversion rate.
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard
              label="Total Pipeline"
              value={formatCurrency(Math.round(forecast.grandTotal))}
              sub={`${forecast.forecastDealCount} open deals with a close date`}
              icon={Wallet}
              color="bg-indigo-500"
            />
            <KpiCard
              label="Weighted Pipeline"
              value={formatCurrency(Math.round(forecast.grandWeighted))}
              sub="Deal value × confidence"
              icon={Scale}
              color="bg-primary"
            />
            <KpiCard
              label="Expected Closed"
              value={formatCurrency(Math.round(forecast.grandExpected))}
              sub={`At ${Math.round(forecast.conversionRate * 100)}% historical conversion`}
              icon={Target}
              color="bg-success"
            />
            <KpiCard
              label="Conversion Rate"
              value={`${Math.round(forecast.conversionRate * 100)}%`}
              sub={`${forecast.convertedLeads} of ${forecast.totalLeads} leads converted`}
              icon={CalendarClock}
              color="bg-amber-500"
            />
          </div>

          {/* Forecast by month */}
          <div className="bg-white rounded-[12px] p-5 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-700">Forecast by Month</h2>
              <span className="text-xs text-gray-400">Grouped by estimated close date</span>
            </div>
            <MonthlyForecastTable rows={forecast.monthRows} maxWeighted={maxWeighted} />
          </div>

          {/* Forecast by adviser */}
          <div className="bg-white rounded-[12px] p-5 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-700">Forecast by Advisor</h2>
              <span className="text-xs text-gray-400">Sorted by weighted value</span>
            </div>
            <AdviserForecastTable rows={forecast.adviserRows} />
          </div>
        </>
      )}
    </div>
  );
}
