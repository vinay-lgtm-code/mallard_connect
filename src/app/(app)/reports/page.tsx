"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useLeads } from "@/hooks/use-leads";
import { useTenantUsers, useAnalyticsSnapshots } from "@/hooks/use-leads";
import { ExportButton } from "@/components/export-button";
import type { Lead, User } from "@/types";
import { TrendingUp, Users, Clock, Target } from "lucide-react";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SOURCE_LABELS: Record<string, string> = {
  website: "Website",
  referral: "Referral",
  phone: "Phone",
  "walk-in": "Walk-in",
  social: "Social",
  "mab-import": "MAB Import",
  other: "Other",
};

const SOURCE_COLORS: Record<string, string> = {
  website: "#6366f1",
  referral: "#14b8a6",
  phone: "#f59e0b",
  "walk-in": "#f97316",
  social: "#a855f7",
  "mab-import": "#3b82f6",
  other: "#9ca3af",
};

const STAGE_COLORS: Record<string, string> = {
  "new-enquiry": "#6366f1",
  "initial-contact": "#3b82f6",
  "not-ready-yet": "#f59e0b",
  nurturing: "#22c55e",
  "ready-to-proceed": "#1d4ed8",
  "referred-to-mab": "#a855f7",
};

function toDate(ts: unknown): Date | null {
  if (!ts) return null;
  if (ts instanceof Date) return ts;
  if (typeof ts === "string") return new Date(ts);
  return null;
}

function getMonthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function getMonthLabel(date: Date): string {
  return date.toLocaleString("default", { month: "short", year: "2-digit" });
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

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
  color: string;
}) {
  return (
    <div className="bg-white rounded-[12px] p-5 shadow-sm border border-gray-100">
      <div className="flex items-start justify-between gap-2 mb-3">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${color}`}>
          <Icon size={16} className="text-white" />
        </div>
      </div>
      <p className="text-3xl font-bold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

// ─── Horizontal Bar ───────────────────────────────────────────────────────────

function HorizontalBar({
  label,
  count,
  total,
  color,
}: {
  label: string;
  count: number;
  total: number;
  color: string;
}) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-gray-600 w-24 flex-shrink-0 truncate" title={label}>
        {label}
      </span>
      <div className="flex-1 bg-gray-100 rounded-full h-2.5 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-xs font-semibold text-gray-700 w-8 text-right flex-shrink-0">
        {count}
      </span>
      <span className="text-xs text-gray-400 w-9 text-right flex-shrink-0">
        {pct.toFixed(0)}%
      </span>
    </div>
  );
}

// ─── Monthly Trend ────────────────────────────────────────────────────────────

function MonthlyTrend({ trend }: { trend: { month: string; count: number; snapshotted: boolean }[] }) {
  const maxCount = Math.max(...trend.map((t) => t.count), 1);
  return (
    <div className="flex items-end gap-3 h-32">
      {trend.map((item) => {
        const heightPct = (item.count / maxCount) * 100;
        return (
          <div key={item.month} className="flex-1 flex flex-col items-center gap-1.5">
            <span className="text-xs font-semibold text-gray-600">{item.count > 0 ? item.count : ""}</span>
            <div className="w-full flex items-end" style={{ height: "80px" }}>
              <div
                className={`w-full rounded-t-md transition-all duration-500 ${
                  item.snapshotted ? "bg-primary/60" : "bg-primary"
                }`}
                style={{ height: `${Math.max(heightPct, 4)}%` }}
                title={`${item.month}: ${item.count}${item.snapshotted ? " (snapshot)" : ""}`}
              />
            </div>
            <span className="text-xs text-gray-400 text-center leading-tight">{item.month}</span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Pipeline Funnel ──────────────────────────────────────────────────────────

interface StageCount {
  id: string;
  name: string;
  count: number;
  color: string;
}

function PipelineFunnel({ stages }: { stages: StageCount[] }) {
  const total = stages.reduce((s, st) => s + st.count, 0);
  if (total === 0) {
    return <p className="text-sm text-gray-400 text-center py-4">No active leads.</p>;
  }
  return (
    <div className="space-y-2">
      {/* Combined stacked bar */}
      <div className="flex rounded-lg overflow-hidden h-5">
        {stages
          .filter((s) => s.count > 0)
          .map((stage) => (
            <div
              key={stage.id}
              style={{
                width: `${(stage.count / total) * 100}%`,
                backgroundColor: stage.color,
              }}
              title={`${stage.name}: ${stage.count}`}
            />
          ))}
      </div>
      {/* Legend + per-stage bars */}
      <div className="space-y-2 mt-3">
        {stages.map((stage) => (
          <div key={stage.id} className="flex items-center gap-2.5">
            <div
              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: stage.color }}
            />
            <span className="text-xs text-gray-600 w-36 flex-shrink-0 truncate">{stage.name}</span>
            <div className="flex-1 bg-gray-100 rounded-full h-1.5 overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: total > 0 ? `${(stage.count / total) * 100}%` : "0%",
                  backgroundColor: stage.color,
                }}
              />
            </div>
            <span className="text-xs font-semibold text-gray-700 w-6 text-right">{stage.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Team Leaderboard ─────────────────────────────────────────────────────────

interface TeamRow {
  userId: string;
  name: string;
  leadCount: number;
  conversionCount: number;
  overdueCount: number;
}

function TeamLeaderboard({ rows }: { rows: TeamRow[] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-gray-400 text-center py-4">No team data.</p>;
  }
  return (
    <div className="overflow-x-auto -mx-1">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-gray-500 border-b border-gray-100">
            <th className="text-left py-2.5 px-1 font-medium">Advisor</th>
            <th className="text-right py-2.5 px-1 font-medium">Leads</th>
            <th className="text-right py-2.5 px-1 font-medium">Converted</th>
            <th className="text-right py-2.5 px-1 font-medium">Overdue</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {rows.map((row, i) => {
            const convRate =
              row.leadCount > 0
                ? Math.round((row.conversionCount / row.leadCount) * 100)
                : 0;
            return (
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
                <td className="py-3 px-1 text-right text-gray-700">{row.leadCount}</td>
                <td className="py-3 px-1 text-right">
                  <span className="text-gray-700">{row.conversionCount}</span>
                  <span className="text-xs text-gray-400 ml-1">({convRate}%)</span>
                </td>
                <td className="py-3 px-1 text-right">
                  {row.overdueCount > 0 ? (
                    <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-xs font-semibold">
                      {row.overdueCount}
                    </span>
                  ) : (
                    <span className="text-gray-400 text-xs">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const KNOWN_STAGES: { id: string; name: string }[] = [
  { id: "new-enquiry", name: "New Enquiry" },
  { id: "initial-contact", name: "Initial Contact" },
  { id: "not-ready-yet", name: "Not Ready Yet" },
  { id: "nurturing", name: "Nurturing" },
  { id: "ready-to-proceed", name: "Ready to Proceed" },
  { id: "referred-to-mab", name: "Referred to MAB" },
];

export default function ReportsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const { leads, loading: leadsLoading } = useLeads();
  const { users, loading: usersLoading } = useTenantUsers();
  const { snapshots } = useAnalyticsSnapshots();

  useEffect(() => {
    if (!loading && !user) router.push("/login");
    if (!loading && user && user.role === "advisor") router.push("/dashboard");
  }, [user, loading, router]);

  // ── Computed KPIs ────────────────────────────────────────────────────────────

  // Snapshotted lead-intake counts keyed by UTC first-of-month (YYYY-MM-01).
  const snapshotIntakeByMonth = useMemo(() => {
    const map: Record<string, number> = {};
    for (const snap of snapshots) {
      const key = (snap.periodMonth ?? "").slice(0, 10);
      const count = snap.metrics?.createdLeadCount;
      if (key && typeof count === "number") map[key] = count;
    }
    return map;
  }, [snapshots]);

  const stats = useMemo(() => {
    if (!leads || leads.length === 0) {
      return {
        totalLeads: 0,
        conversionRate: 0,
        avgDaysInPipeline: 0,
        leadsBySource: {} as Record<string, number>,
        stageData: [] as StageCount[],
        monthlyTrend: [] as { month: string; count: number; snapshotted: boolean }[],
      };
    }

    const totalLeads = leads.length;
    const converted = leads.filter((l) => l.status === "converted").length;
    const conversionRate =
      totalLeads > 0 ? Math.round((converted / totalLeads) * 100 * 10) / 10 : 0;

    const now = Date.now();
    const activeLeads = leads.filter((l) => l.status === "active");
    let avgDaysInPipeline = 0;
    if (activeLeads.length > 0) {
      const totalDays = activeLeads.reduce((sum, lead) => {
        const created = toDate(lead.createdAt);
        if (!created) return sum;
        return sum + (now - created.getTime()) / (1000 * 60 * 60 * 24);
      }, 0);
      avgDaysInPipeline = Math.round(totalDays / activeLeads.length);
    }

    // Leads by source
    const leadsBySource: Record<string, number> = {};
    for (const lead of leads) {
      const src = lead.source ?? "other";
      leadsBySource[src] = (leadsBySource[src] ?? 0) + 1;
    }

    // Leads by stage
    const stageCounts: Record<string, number> = {};
    for (const lead of leads) {
      const stageId = lead.currentStageId ?? "unknown";
      stageCounts[stageId] = (stageCounts[stageId] ?? 0) + 1;
    }
    const stageData: StageCount[] = KNOWN_STAGES.map((s) => ({
      id: s.id,
      name: s.name,
      count: stageCounts[s.id] ?? 0,
      color: STAGE_COLORS[s.id] ?? "#9ca3af",
    }));
    // Add any unknown stages seen in data
    for (const [stageId, count] of Object.entries(stageCounts)) {
      if (!KNOWN_STAGES.find((s) => s.id === stageId)) {
        stageData.push({ id: stageId, name: stageId, count, color: "#9ca3af" });
      }
    }

    // Monthly trend — last 6 months. PAST months read snapshotted intake when
    // a snapshot exists; the current month (i === 0) is always computed live.
    const nowDate = new Date();
    const monthlyTrend: { month: string; count: number; snapshotted: boolean }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(nowDate.getFullYear(), nowDate.getMonth() - i, 1);
      const key = getMonthKey(d);
      const label = getMonthLabel(d);
      const utcKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
      const snapshotCount = i > 0 ? snapshotIntakeByMonth[utcKey] : undefined;
      const liveCount = leads.filter((lead) => {
        const created = toDate(lead.createdAt);
        if (!created) return false;
        return getMonthKey(created) === key;
      }).length;
      const snapshotted = typeof snapshotCount === "number";
      monthlyTrend.push({ month: label, count: snapshotted ? snapshotCount! : liveCount, snapshotted });
    }

    return { totalLeads, conversionRate, avgDaysInPipeline, leadsBySource, stageData, monthlyTrend };
  }, [leads, snapshotIntakeByMonth]);

  // ── Team leaderboard ─────────────────────────────────────────────────────────

  const teamRows = useMemo((): TeamRow[] => {
    if (!leads || !users) return [];

    const now = new Date();

    return (users as (User & { id: string })[])
      .filter((u) => u.isActive)
      .map((u) => {
        const userLeads: Lead[] = leads.filter((l) => l.assignedTo === u.id);
        const conversionCount = userLeads.filter((l) => l.status === "converted").length;
        const overdueCount = userLeads.filter((l) => {
          const followUp = toDate(l.nextFollowUpDate);
          return followUp && followUp < now && l.status === "active";
        }).length;
        return {
          userId: u.id,
          name: u.fullName,
          leadCount: userLeads.length,
          conversionCount,
          overdueCount,
        };
      })
      .sort((a, b) => b.conversionCount - a.conversionCount);
  }, [leads, users]);

  // ── CSV export data ──────────────────────────────────────────────────────────

  const exportData = useMemo(() => {
    if (!leads) return [];
    return leads.map((l) => ({
      ...l,
      createdAt: toDate(l.createdAt)?.toISOString() ?? "",
      updatedAt: toDate(l.updatedAt)?.toISOString() ?? "",
      convertedAt: toDate(l.convertedAt)?.toISOString() ?? "",
      nextFollowUpDate: toDate(l.nextFollowUpDate)?.toISOString() ?? "",
    }));
  }, [leads]);

  // ── Guard ────────────────────────────────────────────────────────────────────

  if (loading || !user) {
    return (
      <div className="flex justify-center py-16">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (user.role === "advisor") return null;

  const isLoading = leadsLoading || usersLoading;
  const sourceEntries = Object.entries(stats.leadsBySource).sort((a, b) => b[1] - a[1]);

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold text-gray-900">Reports</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Live data for the current period. Past months use nightly snapshots.
          </p>
        </div>
        <ExportButton
          data={exportData as Record<string, unknown>[]}
          columns={[
            { key: "id", header: "ID" },
            { key: "firstName", header: "First Name" },
            { key: "lastName", header: "Last Name" },
            { key: "email", header: "Email" },
            { key: "phone", header: "Phone" },
            { key: "source", header: "Source" },
            { key: "status", header: "Status" },
            { key: "currentStageId", header: "Stage" },
            { key: "assignedTo", header: "Assigned To" },
            { key: "createdAt", header: "Created At" },
          ]}
          filename="mallard-connect-leads"
        />
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
              label="Total Leads"
              value={stats.totalLeads}
              sub="All time"
              icon={Users}
              color="bg-indigo-500"
            />
            <KpiCard
              label="Conversion Rate"
              value={`${stats.conversionRate}%`}
              sub={`${leads?.filter((l) => l.status === "converted").length ?? 0} converted`}
              icon={Target}
              color="bg-success"
            />
            <KpiCard
              label="Avg Days in Pipeline"
              value={stats.avgDaysInPipeline}
              sub="Active leads only"
              icon={Clock}
              color="bg-amber-500"
            />
            <KpiCard
              label="Active Leads"
              value={leads?.filter((l) => l.status === "active").length ?? 0}
              sub="Currently in pipeline"
              icon={TrendingUp}
              color="bg-primary"
            />
          </div>

          {/* Pipeline Funnel + Monthly Trend */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="bg-white rounded-[12px] p-5 shadow-sm border border-gray-100">
              <h2 className="text-sm font-semibold text-gray-700 mb-4">Pipeline Funnel</h2>
              <PipelineFunnel stages={stats.stageData} />
            </div>

            <div className="bg-white rounded-[12px] p-5 shadow-sm border border-gray-100">
              <h2 className="text-sm font-semibold text-gray-700 mb-4">Monthly Lead Intake (last 6 months)</h2>
              {stats.monthlyTrend.length > 0 ? (
                <MonthlyTrend trend={stats.monthlyTrend} />
              ) : (
                <p className="text-sm text-gray-400 text-center py-4">No data.</p>
              )}
              <p className="text-[11px] text-gray-400 mt-4 leading-snug">
                Historical figures are snapshotted nightly (shown in a lighter shade). The current
                month is computed live and will keep changing until month-end.
              </p>
            </div>
          </div>

          {/* Leads by Source */}
          <div className="bg-white rounded-[12px] p-5 shadow-sm border border-gray-100">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">Leads by Source</h2>
            {sourceEntries.length === 0 ? (
              <p className="text-sm text-gray-400">No data.</p>
            ) : (
              <div className="space-y-3">
                {sourceEntries.map(([source, count]) => (
                  <HorizontalBar
                    key={source}
                    label={SOURCE_LABELS[source] ?? source}
                    count={count}
                    total={stats.totalLeads}
                    color={SOURCE_COLORS[source] ?? "#9ca3af"}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Team Leaderboard */}
          <div className="bg-white rounded-[12px] p-5 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-700">Team Leaderboard</h2>
              <span className="text-xs text-gray-400">Sorted by conversions</span>
            </div>
            <TeamLeaderboard rows={teamRows} />
          </div>
        </>
      )}
    </div>
  );
}
