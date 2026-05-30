"use client";

import { useEffect, useState } from "react";
import { startOfWeek } from "date-fns";
import { useAuth } from "@/hooks/useAuth";
import { useSupabase } from "@/hooks/use-supabase";
import { isDemoUser, getMockActivities } from "@/lib/mock-data";
import { rowsToApp } from "@/lib/supabase/mappers";
import type { Activity } from "@/types";

export interface WeeklyUserSummary {
  userId: string;
  thisWeek: number;
  lastWeek: number;
}

export function useWeeklyActivitySummary() {
  const { user } = useAuth();
  const supabase = useSupabase();
  const demo = user ? isDemoUser(user.id) : false;
  const tenantId = user?.tenantId;

  const [data, setData] = useState<WeeklyUserSummary[]>([]);
  const [loading, setLoading] = useState(!demo);

  useEffect(() => {
    const now = new Date();
    const thisWeekStart = startOfWeek(now, { weekStartsOn: 1 });
    const lastWeekStart = new Date(thisWeekStart.getTime() - 7 * 24 * 60 * 60 * 1000);

    if (demo) {
      const all = getMockActivities() as (Activity & { id: string })[];
      setData(aggregate(all, thisWeekStart, lastWeekStart));
      setLoading(false);
      return;
    }

    if (!supabase || !tenantId) {
      setData([]);
      setLoading(false);
      return;
    }

    supabase
      .from("activities")
      .select("*")
      .eq("tenant_id", tenantId)
      .gte("created_at", lastWeekStart.toISOString())
      .then(({ data: rows }) => {
        const activities = rowsToApp<Activity & { id: string }>(rows ?? []);
        setData(aggregate(activities, thisWeekStart, lastWeekStart));
        setLoading(false);
      });
  }, [supabase, tenantId, demo]);

  return { summary: data, loading };
}

function aggregate(
  activities: Activity[],
  thisWeekStart: Date,
  lastWeekStart: Date
): WeeklyUserSummary[] {
  const map = new Map<string, { thisWeek: number; lastWeek: number }>();

  for (const act of activities) {
    const ts = new Date(act.createdAt);
    if (ts < lastWeekStart) continue;
    const bucket = ts >= thisWeekStart ? "thisWeek" : "lastWeek";
    const entry = map.get(act.performedBy) ?? { thisWeek: 0, lastWeek: 0 };
    entry[bucket]++;
    map.set(act.performedBy, entry);
  }

  return Array.from(map.entries())
    .map(([userId, counts]) => ({ userId, ...counts }))
    .sort((a, b) => (b.thisWeek + b.lastWeek) - (a.thisWeek + a.lastWeek));
}
