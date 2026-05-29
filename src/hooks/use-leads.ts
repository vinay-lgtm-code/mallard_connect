"use client";

import { useEffect, useState } from "react";
import {
  collectionGroup,
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
  limit as fbLimit,
  type QueryConstraint,
} from "firebase/firestore";
import { useRealtimeCollection, useRealtimeDoc } from "@/hooks/use-realtime";
import { useAuth } from "@/hooks/useAuth";
import { isDemoUser, getMockLeads, getMockActivities, getMockTasks, getMockUsers } from "@/lib/mock-data";
import { db, isFirebaseConfigured } from "@/lib/firebase/client";
import { leadsPath, leadPath, activitiesPath, leadTasksPath, usersPath } from "@/lib/firebase/paths";
import type { Lead, Activity, Task, User } from "@/types";

interface LeadFilters {
  stageId?: string;
  assignedTo?: string;
  status?: string;
}

function tenantScoped(tenantId: string | undefined, demo: boolean, builder: (tid: string, demo: boolean) => string): string {
  return tenantId ? builder(tenantId, demo) : "__skip__";
}

export function useLeads(filters?: LeadFilters) {
  const { user } = useAuth();
  const demo = user ? isDemoUser(user.id) : false;

  if (demo && !isFirebaseConfigured) {
    let leads = getMockLeads() as (Lead & { id: string })[];
    if (filters?.stageId) leads = leads.filter((l) => l.currentStageId === filters.stageId);
    if (filters?.assignedTo) leads = leads.filter((l) => l.assignedTo === filters.assignedTo);
    if (filters?.status) leads = leads.filter((l) => l.status === filters.status);
    return { leads, loading: false, error: null };
  }

  const constraints: QueryConstraint[] = [];

  if (filters?.stageId) {
    constraints.push(where("currentStageId", "==", filters.stageId));
  }
  if (filters?.assignedTo) {
    constraints.push(where("assignedTo", "==", filters.assignedTo));
  }
  if (filters?.status) {
    constraints.push(where("status", "==", filters.status));
  }

  constraints.push(orderBy("updatedAt", "desc"));

  const path = tenantScoped(user?.tenantId, demo, leadsPath);
  const { data, loading, error } = useRealtimeCollection<Lead>(path, constraints);

  return { leads: data, loading, error };
}

export function useLead(leadId: string) {
  const { user } = useAuth();
  const demo = user ? isDemoUser(user.id) : false;

  if (demo && !isFirebaseConfigured) {
    const lead = (getMockLeads() as (Lead & { id: string })[]).find((l) => l.id === leadId) ?? null;
    return { lead, loading: false, error: null };
  }

  const path = user?.tenantId ? leadPath(user.tenantId, leadId, demo) : "__skip__";
  const { data, loading, error } = useRealtimeDoc<Lead>(path);
  return { lead: data, loading, error };
}

export function useLeadActivities(leadId: string) {
  const { user } = useAuth();
  const demo = user ? isDemoUser(user.id) : false;

  if (demo && !isFirebaseConfigured) {
    const activities = (getMockActivities() as (Activity & { id: string })[]).filter((a) => a.leadId === leadId);
    return { activities, loading: false, error: null };
  }

  const constraints: QueryConstraint[] = [orderBy("createdAt", "desc")];
  const path = user?.tenantId ? activitiesPath(user.tenantId, leadId, demo) : "__skip__";
  const { data, loading, error } = useRealtimeCollection<Activity>(path, constraints);
  return { activities: data, loading, error };
}

export function useLeadTasks(leadId: string) {
  const { user } = useAuth();
  const demo = user ? isDemoUser(user.id) : false;

  if (demo && !isFirebaseConfigured) {
    const tasks = (getMockTasks() as (Task & { id: string })[]).filter((t) => t.leadId === leadId);
    return { tasks, loading: false, error: null };
  }

  const constraints: QueryConstraint[] = [orderBy("dueDate", "asc")];
  const path = user?.tenantId ? leadTasksPath(user.tenantId, leadId, demo) : "__skip__";
  const { data, loading, error } = useRealtimeCollection<Task>(path, constraints);
  return { tasks: data, loading, error };
}

/**
 * Recent activities across all leads in the current tenant. Uses a collection-
 * group query so we don't have to fan out per lead. Activity docs carry a
 * `tenantId` field — set by both the seeder and the live writers — so the
 * filter still scopes correctly across both demo and real namespaces.
 */
export function useRecentActivities(maxItems = 10) {
  const { user } = useAuth();
  const demo = user ? isDemoUser(user.id) : false;
  const tenantId = user?.tenantId;
  const [data, setData] = useState<(Activity & { id: string })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (demo && !isFirebaseConfigured) {
      setData((getMockActivities() as (Activity & { id: string })[]).slice(0, maxItems));
      setLoading(false);
      return;
    }
    if (!isFirebaseConfigured || !tenantId) {
      setData([]);
      setLoading(false);
      return;
    }
    const q = query(
      collectionGroup(db, "activities"),
      where("tenantId", "==", tenantId),
      orderBy("createdAt", "desc"),
      fbLimit(maxItems),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setData(
          snap.docs.map((d) => {
            const raw = d.data() as Record<string, unknown>;
            return {
              ...(raw as unknown as Activity),
              id: d.id,
            };
          }),
        );
        setLoading(false);
      },
      () => setLoading(false),
    );
    return unsub;
  }, [tenantId, maxItems]);

  return { activities: data, loading };
}

/**
 * Users belonging to the current tenant. In demo mode reads from
 * demoTenants/{slug}/users (seeded); in real mode from a top-level `users`
 * collection filtered by tenantId.
 */
export function useTenantUsers() {
  const { user } = useAuth();
  const tenantId = user?.tenantId;
  const demo = user ? isDemoUser(user.id) : false;
  const [data, setData] = useState<(User & { id: string })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (demo && !isFirebaseConfigured) {
      setData(getMockUsers() as (User & { id: string })[]);
      setLoading(false);
      return;
    }
    if (!isFirebaseConfigured || !tenantId) {
      setData([]);
      setLoading(false);
      return;
    }
    const path = demo ? usersPath(tenantId, true) : "users";
    const q = demo
      ? query(collection(db, path))
      : query(collection(db, path), where("tenantId", "==", tenantId));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setData(snap.docs.map((d) => ({ ...(d.data() as User), id: d.id })));
        setLoading(false);
      },
      () => setLoading(false),
    );
    return unsub;
  }, [tenantId, demo]);

  return { users: data, loading };
}
