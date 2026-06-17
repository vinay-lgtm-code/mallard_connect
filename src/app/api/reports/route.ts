import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { verifyToken, authError } from "@/lib/auth/verify-token";

interface TeamPerformanceEntry {
  userId: string;
  leadCount: number;
  conversionCount: number;
}

interface ReportData {
  totalLeads: number;
  conversionRate: number;
  avgDaysInPipeline: number;
  leadsBySource: Record<string, number>;
  leadsByStage: Record<string, number>;
  teamPerformance: TeamPerformanceEntry[];
  monthlyTrend: { month: string; count: number }[];
}

const cache = new Map<string, { timestamp: number; data: ReportData }>();
const CACHE_TTL_MS = 5 * 60 * 1000;

export async function GET(request: NextRequest) {
  const result = await verifyToken(request, { requireCapability: "viewReports" });
  if (!result.ok) return authError(result);
  const { auth } = result;

  const now = Date.now();
  const cached = cache.get(auth.tenantId);
  if (cached && now - cached.timestamp < CACHE_TTL_MS) {
    return NextResponse.json(cached.data);
  }

  try {
    const supabase = createServiceClient();
    const { data: leads, error } = await supabase
      .from("leads")
      .select("id, status, source_id, current_stage_id, assigned_to, created_at, converted_at")
      .eq("tenant_id", auth.tenantId);

    if (error) throw error;

    const totalLeads = leads.length;
    const convertedLeads = leads.filter((l) => l.status === "converted");
    const conversionRate =
      totalLeads > 0 ? Math.round((convertedLeads.length / totalLeads) * 100 * 10) / 10 : 0;

    const activeLeads = leads.filter((l) => l.status === "active");
    let avgDaysInPipeline = 0;
    if (activeLeads.length > 0) {
      const totalDays = activeLeads.reduce((sum, lead) => {
        if (!lead.created_at) return sum;
        const diffMs = now - new Date(lead.created_at).getTime();
        return sum + diffMs / (1000 * 60 * 60 * 24);
      }, 0);
      avgDaysInPipeline = Math.round(totalDays / activeLeads.length);
    }

    const leadsBySource: Record<string, number> = {};
    for (const lead of leads) {
      const src = lead.source_id ?? "other";
      leadsBySource[src] = (leadsBySource[src] ?? 0) + 1;
    }

    const leadsByStage: Record<string, number> = {};
    for (const lead of leads) {
      const stage = lead.current_stage_id ?? "unknown";
      leadsByStage[stage] = (leadsByStage[stage] ?? 0) + 1;
    }

    const teamMap: Record<string, TeamPerformanceEntry> = {};
    for (const lead of leads) {
      const uid = lead.assigned_to ?? "unassigned";
      if (!teamMap[uid]) {
        teamMap[uid] = { userId: uid, leadCount: 0, conversionCount: 0 };
      }
      teamMap[uid].leadCount += 1;
      if (lead.status === "converted") {
        teamMap[uid].conversionCount += 1;
      }
    }
    const teamPerformance = Object.values(teamMap).sort(
      (a, b) => b.conversionCount - a.conversionCount
    );

    const monthlyTrend: { month: string; count: number }[] = [];
    const nowDate = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(nowDate.getFullYear(), nowDate.getMonth() - i, 1);
      const year = d.getFullYear();
      const month = d.getMonth();
      const label = d.toLocaleString("default", { month: "short", year: "2-digit" });
      const count = leads.filter((lead) => {
        if (!lead.created_at) return false;
        const created = new Date(lead.created_at);
        return created.getFullYear() === year && created.getMonth() === month;
      }).length;
      monthlyTrend.push({ month: label, count });
    }

    const data: ReportData = {
      totalLeads,
      conversionRate,
      avgDaysInPipeline,
      leadsBySource,
      leadsByStage,
      teamPerformance,
      monthlyTrend,
    };

    cache.set(auth.tenantId, { timestamp: now, data });
    return NextResponse.json(data);
  } catch (err) {
    console.error("[reports/route] Error:", err);
    return NextResponse.json({ error: "Failed to generate report" }, { status: 500 });
  }
}
