"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useSupabase, isSupabaseConfigured } from "@/hooks/use-supabase";
import { isDemoUser, getMockLeads, getMockActivities, getMockTasks, getMockUsers } from "@/lib/mock-data";
import { rowsToApp, rowToApp } from "@/lib/supabase/mappers";
import type { Lead, Activity, Task, User } from "@/types";

interface LeadFilters {
  stageId?: string;
  assignedTo?: string;
  status?: string;
}

export function useLeads(filters?: LeadFilters) {
  const { user } = useAuth();
  const supabase = useSupabase();
  const demo = user ? isDemoUser(user.id) : false;
  const useMock = demo && !isSupabaseConfigured;
  const tenantId = user?.tenantId;

  const [data, setData] = useState<(Lead & { id: string })[]>([]);
  const [loading, setLoading] = useState(!useMock);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (useMock || !supabase || !tenantId) return;

    let query = supabase
      .from("leads")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("updated_at", { ascending: false });

    if (filters?.stageId) query = query.eq("current_stage_id", filters.stageId);
    if (filters?.assignedTo) query = query.eq("assigned_to", filters.assignedTo);
    if (filters?.status) query = query.eq("status", filters.status);

    query.then(({ data: rows, error: err }) => {
      if (err) { setError(new Error(err.message)); }
      else { setData(rowsToApp<Lead & { id: string }>(rows ?? [])); }
      setLoading(false);
    });
  }, [supabase, tenantId, filters?.stageId, filters?.assignedTo, filters?.status, useMock]);

  if (useMock) {
    let leads = getMockLeads() as (Lead & { id: string })[];
    if (filters?.stageId) leads = leads.filter((l) => l.currentStageId === filters.stageId);
    if (filters?.assignedTo) leads = leads.filter((l) => l.assignedTo === filters.assignedTo);
    if (filters?.status) leads = leads.filter((l) => l.status === filters.status);
    return { leads, loading: false, error: null };
  }

  return { leads: data, loading, error };
}

export function useLead(leadId: string) {
  const { user } = useAuth();
  const supabase = useSupabase();
  const demo = user ? isDemoUser(user.id) : false;
  const useMock = demo && !isSupabaseConfigured;
  const tenantId = user?.tenantId;

  const [data, setData] = useState<(Lead & { id: string }) | null>(null);
  const [loading, setLoading] = useState(!useMock);
  const [error, setError] = useState<Error | null>(null);

  const refetch = useCallback(() => {
    if (!supabase || !tenantId || useMock) return;
    supabase
      .from("leads")
      .select("*")
      .eq("id", leadId)
      .eq("tenant_id", tenantId)
      .single()
      .then(({ data: row, error: err }) => {
        if (err) { setError(new Error(err.message)); }
        else { setData(row ? rowToApp<Lead & { id: string }>(row) : null); }
        setLoading(false);
      });
  }, [supabase, tenantId, leadId, useMock]);

  useEffect(() => { refetch(); }, [refetch]);

  if (useMock) {
    const lead = (getMockLeads() as (Lead & { id: string })[]).find((l) => l.id === leadId) ?? null;
    return { lead, loading: false, error: null, refetch };
  }

  return { lead: data, loading, error, refetch };
}

export function useLeadActivities(leadId: string) {
  const { user } = useAuth();
  const supabase = useSupabase();
  const demo = user ? isDemoUser(user.id) : false;
  const useMock = demo && !isSupabaseConfigured;
  const tenantId = user?.tenantId;

  const [data, setData] = useState<(Activity & { id: string })[]>([]);
  const [loading, setLoading] = useState(!useMock);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (useMock || !supabase || !tenantId) return;
    supabase
      .from("activities")
      .select("*")
      .eq("lead_id", leadId)
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .then(({ data: rows, error: err }) => {
        if (err) { setError(new Error(err.message)); }
        else { setData(rowsToApp<Activity & { id: string }>(rows ?? [])); }
        setLoading(false);
      });
  }, [supabase, tenantId, leadId, useMock]);

  if (useMock) {
    const activities = (getMockActivities() as (Activity & { id: string })[]).filter((a) => a.leadId === leadId);
    return { activities, loading: false, error: null };
  }

  return { activities: data, loading, error };
}

export function useLeadTasks(leadId: string) {
  const { user } = useAuth();
  const supabase = useSupabase();
  const demo = user ? isDemoUser(user.id) : false;
  const useMock = demo && !isSupabaseConfigured;
  const tenantId = user?.tenantId;

  const [data, setData] = useState<(Task & { id: string })[]>([]);
  const [loading, setLoading] = useState(!useMock);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (useMock || !supabase || !tenantId) return;
    supabase
      .from("tasks")
      .select("*")
      .eq("lead_id", leadId)
      .eq("tenant_id", tenantId)
      .order("due_date", { ascending: true })
      .then(({ data: rows, error: err }) => {
        if (err) { setError(new Error(err.message)); }
        else { setData(rowsToApp<Task & { id: string }>(rows ?? [])); }
        setLoading(false);
      });
  }, [supabase, tenantId, leadId, useMock]);

  if (useMock) {
    const tasks = (getMockTasks() as (Task & { id: string })[]).filter((t) => t.leadId === leadId);
    return { tasks, loading: false, error: null };
  }

  return { tasks: data, loading, error };
}

export function useRecentActivities(maxItems = 10) {
  const { user } = useAuth();
  const supabase = useSupabase();
  const demo = user ? isDemoUser(user.id) : false;
  const useMock = demo && !isSupabaseConfigured;
  const tenantId = user?.tenantId;

  const [data, setData] = useState<(Activity & { id: string })[]>([]);
  const [loading, setLoading] = useState(!useMock);

  useEffect(() => {
    if (useMock) {
      setData((getMockActivities() as (Activity & { id: string })[]).slice(0, maxItems));
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
      .order("created_at", { ascending: false })
      .limit(maxItems)
      .then(({ data: rows }) => {
        setData(rowsToApp<Activity & { id: string }>(rows ?? []));
        setLoading(false);
      });
  }, [supabase, tenantId, maxItems, useMock]);

  return { activities: data, loading };
}

export function useTenantUsers() {
  const { user } = useAuth();
  const supabase = useSupabase();
  const demo = user ? isDemoUser(user.id) : false;
  const useMock = demo && !isSupabaseConfigured;
  const tenantId = user?.tenantId;

  const [data, setData] = useState<(User & { id: string })[]>([]);
  const [loading, setLoading] = useState(!useMock);

  useEffect(() => {
    if (useMock) {
      setData(getMockUsers() as (User & { id: string })[]);
      setLoading(false);
      return;
    }
    if (!supabase || !tenantId) {
      setData([]);
      setLoading(false);
      return;
    }
    supabase
      .from("users")
      .select("*")
      .eq("tenant_id", tenantId)
      .then(({ data: rows }) => {
        setData(rowsToApp<User & { id: string }>(rows ?? []));
        setLoading(false);
      });
  }, [supabase, tenantId, useMock]);

  return { users: data, loading };
}
