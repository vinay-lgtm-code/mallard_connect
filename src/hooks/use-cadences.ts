"use client";

import { orderBy, where, type QueryConstraint } from "firebase/firestore";
import { useRealtimeCollection } from "@/hooks/use-realtime";
import { useAuth } from "@/hooks/useAuth";
import { isDemoUser } from "@/lib/mock-data";
import { cadencesPath, cadenceEnrollmentsPath } from "@/lib/firebase/paths";
import type { Cadence, CadenceEnrollment } from "@/types";

export function useCadences() {
  const { user } = useAuth();
  const demo = user ? isDemoUser(user.id) : false;
  const path = user?.tenantId ? cadencesPath(user.tenantId, demo) : "__skip__";
  const constraints: QueryConstraint[] = [orderBy("name", "asc")];
  const { data, loading, error } = useRealtimeCollection<Cadence>(path, constraints);
  return { cadences: data, loading, error };
}

export function useCadenceEnrollments(cadenceId?: string) {
  const { user } = useAuth();
  const demo = user ? isDemoUser(user.id) : false;
  const path = user?.tenantId ? cadenceEnrollmentsPath(user.tenantId, demo) : "__skip__";
  const constraints: QueryConstraint[] = cadenceId
    ? [where("cadenceId", "==", cadenceId)]
    : [];
  const { data, loading, error } = useRealtimeCollection<CadenceEnrollment>(path, constraints);
  return { enrollments: data, loading, error };
}
