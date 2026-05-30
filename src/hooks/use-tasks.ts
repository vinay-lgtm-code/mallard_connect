"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useSupabase, isSupabaseConfigured } from "@/hooks/use-supabase";
import { isDemoUser, getMockTasks } from "@/lib/mock-data";
import type { Task } from "@/types";

interface TaskFilters {
  assignedTo?: string;
  status?: string;
  dueDate?: string;
}

export function useTasks(filters?: TaskFilters) {
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

    let query = supabase
      .from("tasks")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("due_date", { ascending: true });

    if (filters?.assignedTo) query = query.eq("assigned_to", filters.assignedTo);
    if (filters?.status) query = query.eq("status", filters.status);
    if (filters?.dueDate) {
      const start = new Date(filters.dueDate); start.setHours(0, 0, 0, 0);
      const end = new Date(filters.dueDate); end.setHours(23, 59, 59, 999);
      query = query.gte("due_date", start.toISOString()).lte("due_date", end.toISOString());
    }

    query.then(({ data: rows, error: err }) => {
      if (err) { setError(new Error(err.message)); }
      else { setData((rows ?? []) as (Task & { id: string })[]); }
      setLoading(false);
    });
  }, [supabase, tenantId, filters?.assignedTo, filters?.status, filters?.dueDate, useMock]);

  if (useMock) {
    let tasks = getMockTasks() as (Task & { id: string })[];
    if (filters?.assignedTo) tasks = tasks.filter((t) => t.assignedTo === filters.assignedTo);
    if (filters?.status) tasks = tasks.filter((t) => t.status === filters.status);
    return { tasks, loading: false, error: null };
  }

  return { tasks: data, loading, error };
}

export function useOverdueTasks(userId: string) {
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

    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);

    let query = supabase
      .from("tasks")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("status", "pending")
      .lt("due_date", todayStart.toISOString())
      .order("due_date", { ascending: true });

    if (userId !== "__manager__") {
      query = query.eq("assigned_to", userId);
    }

    query.then(({ data: rows, error: err }) => {
      if (err) { setError(new Error(err.message)); }
      else { setData((rows ?? []) as (Task & { id: string })[]); }
      setLoading(false);
    });
  }, [supabase, tenantId, userId, useMock]);

  if (useMock) {
    const now = new Date(); now.setHours(0, 0, 0, 0);
    let tasks = getMockTasks() as (Task & { id: string })[];
    tasks = tasks.filter((t) => t.status === "pending" && t.dueDate && (t.dueDate as unknown as Date) < now);
    if (userId !== "__manager__") tasks = tasks.filter((t) => t.assignedTo === userId);
    return { tasks, loading: false, error: null };
  }

  return { tasks: data, loading, error };
}

export function useTodayTasks(userId: string) {
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

    const start = new Date(); start.setHours(0, 0, 0, 0);
    const end = new Date(); end.setHours(23, 59, 59, 999);

    let query = supabase
      .from("tasks")
      .select("*")
      .eq("tenant_id", tenantId)
      .gte("due_date", start.toISOString())
      .lte("due_date", end.toISOString())
      .order("due_date", { ascending: true });

    if (userId !== "__manager__") {
      query = query.eq("assigned_to", userId);
    }

    query.then(({ data: rows, error: err }) => {
      if (err) { setError(new Error(err.message)); }
      else { setData((rows ?? []) as (Task & { id: string })[]); }
      setLoading(false);
    });
  }, [supabase, tenantId, userId, useMock]);

  if (useMock) {
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const end = new Date(); end.setHours(23, 59, 59, 999);
    let tasks = getMockTasks() as (Task & { id: string })[];
    tasks = tasks.filter((t) => {
      if (!t.dueDate) return false;
      const d = t.dueDate as unknown as Date;
      return d >= start && d <= end;
    });
    if (userId !== "__manager__") tasks = tasks.filter((t) => t.assignedTo === userId);
    return { tasks, loading: false, error: null };
  }

  return { tasks: data, loading, error };
}
