import { NextResponse } from "next/server";
import { getFirestoreAdmin } from "@/lib/firebase/admin";

interface LeadDoc {
  status?: string;
  source?: string;
  currentStageId?: string;
  assignedTo?: string;
  createdAt?: { toDate?: () => Date; _seconds?: number } | Date;
  convertedAt?: { toDate?: () => Date; _seconds?: number } | Date | null;
}

interface TeamPerformanceEntry {
  userId: string;
  leadCount: number;
  conversionCount: number;
}

interface CacheEntry {
  timestamp: number;
  data: ReportData;
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

// 5-minute module-level cache
let cache: CacheEntry | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000;

function toDate(val: LeadDoc["createdAt"]): Date | null {
  if (!val) return null;
  if (val instanceof Date) return val;
  if (typeof (val as { toDate?: () => Date }).toDate === "function") {
    return (val as { toDate: () => Date }).toDate();
  }
  if (typeof (val as { _seconds?: number })._seconds === "number") {
    return new Date((val as { _seconds: number })._seconds * 1000);
  }
  return null;
}

export async function GET() {
  const now = Date.now();

  if (cache && now - cache.timestamp < CACHE_TTL_MS) {
    return NextResponse.json(cache.data);
  }

  try {
    const db = getFirestoreAdmin();
    const leadsSnap = await db.collection("leads").get();
    const leads: LeadDoc[] = leadsSnap.docs.map((d) => d.data() as LeadDoc);

    const totalLeads = leads.length;

    const convertedLeads = leads.filter((l) => l.status === "converted");
    const conversionRate =
      totalLeads > 0 ? Math.round((convertedLeads.length / totalLeads) * 100 * 10) / 10 : 0;

    // Avg days in pipeline for active leads
    const activeLeads = leads.filter((l) => l.status === "active");
    let avgDaysInPipeline = 0;
    if (activeLeads.length > 0) {
      const totalDays = activeLeads.reduce((sum, lead) => {
        const created = toDate(lead.createdAt);
        if (!created) return sum;
        const diffMs = now - created.getTime();
        return sum + diffMs / (1000 * 60 * 60 * 24);
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
    const leadsByStage: Record<string, number> = {};
    for (const lead of leads) {
      const stage = lead.currentStageId ?? "unknown";
      leadsByStage[stage] = (leadsByStage[stage] ?? 0) + 1;
    }

    // Team performance
    const teamMap: Record<string, TeamPerformanceEntry> = {};
    for (const lead of leads) {
      const uid = lead.assignedTo ?? "unassigned";
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

    // Monthly trend — last 6 months
    const monthlyTrend: { month: string; count: number }[] = [];
    const nowDate = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(nowDate.getFullYear(), nowDate.getMonth() - i, 1);
      const year = d.getFullYear();
      const month = d.getMonth();
      const label = d.toLocaleString("default", { month: "short", year: "2-digit" });
      const count = leads.filter((lead) => {
        const created = toDate(lead.createdAt);
        if (!created) return false;
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

    cache = { timestamp: now, data };

    return NextResponse.json(data);
  } catch (err) {
    console.error("[reports/route] Error:", err);
    return NextResponse.json({ error: "Failed to generate report" }, { status: 500 });
  }
}
