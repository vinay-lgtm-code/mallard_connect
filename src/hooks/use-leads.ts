"use client";

import { orderBy, where, type QueryConstraint } from "firebase/firestore";
import { useRealtimeCollection, useRealtimeDoc } from "@/hooks/use-realtime";
import type { Lead, Activity, Task } from "@/types";

interface LeadFilters {
  stageId?: string;
  assignedTo?: string;
  status?: string;
}

export function useLeads(filters?: LeadFilters) {
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

  const { data, loading, error } = useRealtimeCollection<Lead>("leads", constraints);

  return { leads: data, loading, error };
}

export function useLead(leadId: string) {
  const { data, loading, error } = useRealtimeDoc<Lead>(`leads/${leadId}`);
  return { lead: data, loading, error };
}

export function useLeadActivities(leadId: string) {
  const constraints: QueryConstraint[] = [orderBy("createdAt", "desc")];

  const { data, loading, error } = useRealtimeCollection<Activity>(
    `leads/${leadId}/activities`,
    constraints
  );

  return { activities: data, loading, error };
}

export function useLeadTasks(leadId: string) {
  const constraints: QueryConstraint[] = [orderBy("dueDate", "asc")];

  const { data, loading, error } = useRealtimeCollection<Task>(
    `leads/${leadId}/tasks`,
    constraints
  );

  return { tasks: data, loading, error };
}
