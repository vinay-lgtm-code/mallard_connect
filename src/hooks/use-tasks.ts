"use client";

import { useMemo } from "react";
import { orderBy, where, Timestamp, type QueryConstraint } from "firebase/firestore";
import { useRealtimeCollection } from "@/hooks/use-realtime";
import { useAuth } from "@/hooks/useAuth";
import { isDemoUser, getMockTasks } from "@/lib/mock-data";
import { isFirebaseConfigured } from "@/lib/firebase/client";
import { tasksPath } from "@/lib/firebase/paths";
import type { Task } from "@/types";

interface TaskFilters {
  assignedTo?: string;
  status?: string;
  dueDate?: string;
}

function pathFor(tenantId: string | undefined, demo: boolean): string {
  return tenantId ? tasksPath(tenantId, demo) : "__skip__";
}

export function useTasks(filters?: TaskFilters) {
  const { user } = useAuth();
  const demo = user ? isDemoUser(user.id) : false;

  if (demo && !isFirebaseConfigured) {
    let tasks = getMockTasks() as (Task & { id: string })[];
    if (filters?.assignedTo) tasks = tasks.filter((t) => t.assignedTo === filters.assignedTo);
    if (filters?.status) tasks = tasks.filter((t) => t.status === filters.status);
    return { tasks, loading: false, error: null };
  }

  const constraints: QueryConstraint[] = [];

  if (filters?.assignedTo) {
    constraints.push(where("assignedTo", "==", filters.assignedTo));
  }
  if (filters?.status) {
    constraints.push(where("status", "==", filters.status));
  }
  if (filters?.dueDate) {
    const start = new Date(filters.dueDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(filters.dueDate);
    end.setHours(23, 59, 59, 999);
    constraints.push(where("dueDate", ">=", Timestamp.fromDate(start)));
    constraints.push(where("dueDate", "<=", Timestamp.fromDate(end)));
  }

  constraints.push(orderBy("dueDate", "asc"));

  const { data, loading, error } = useRealtimeCollection<Task>(pathFor(user?.tenantId, demo), constraints);

  return { tasks: data, loading, error };
}

export function useOverdueTasks(userId: string) {
  const { user } = useAuth();
  const demo = user ? isDemoUser(user.id) : false;

  if (demo && !isFirebaseConfigured) {
    const now = new Date(); now.setHours(0, 0, 0, 0);
    let tasks = getMockTasks() as (Task & { id: string })[];
    tasks = tasks.filter((t) => t.status === "pending" && t.dueDate && (t.dueDate as unknown as Date) < now);
    if (userId !== "__manager__") tasks = tasks.filter((t) => t.assignedTo === userId);
    return { tasks, loading: false, error: null };
  }

  const todayStart = Timestamp.fromDate((() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; })());

  const skip = userId === "__skip__" || !user?.tenantId;
  const constraints: QueryConstraint[] = skip ? [] : [
    where("assignedTo", "==", userId),
    where("status", "==", "pending"),
    where("dueDate", "<", todayStart),
    orderBy("dueDate", "asc"),
  ];

  const { data, loading, error } = useRealtimeCollection<Task>(
    skip ? "__skip__" : pathFor(user.tenantId, demo),
    constraints
  );

  return { tasks: data, loading, error };
}

export function useTodayTasks(userId: string) {
  const { user } = useAuth();
  const demo = user ? isDemoUser(user.id) : false;

  if (demo && !isFirebaseConfigured) {
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

  const { todayStart, todayEnd } = useMemo(() => {
    const s = new Date(); s.setHours(0, 0, 0, 0);
    const e = new Date(); e.setHours(23, 59, 59, 999);
    return { todayStart: Timestamp.fromDate(s), todayEnd: Timestamp.fromDate(e) };
  }, []);

  const skip = userId === "__skip__" || !user?.tenantId;
  const constraints: QueryConstraint[] = skip ? [] : [
    where("assignedTo", "==", userId),
    where("dueDate", ">=", todayStart),
    where("dueDate", "<=", todayEnd),
    orderBy("dueDate", "asc"),
  ];

  const { data, loading, error } = useRealtimeCollection<Task>(
    skip ? "__skip__" : pathFor(user.tenantId, demo),
    constraints
  );

  return { tasks: data, loading, error };
}
