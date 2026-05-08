"use client";

import { orderBy, type QueryConstraint } from "firebase/firestore";
import { useRealtimeCollection } from "@/hooks/use-realtime";
import { useAuth } from "@/hooks/useAuth";
import { isDemoUser } from "@/lib/mock-data";
import { templatesPath } from "@/lib/firebase/paths";
import type { Template } from "@/types";

export function useTemplates() {
  const { user } = useAuth();
  const demo = user ? isDemoUser(user.id) : false;
  const path = user?.tenantId ? templatesPath(user.tenantId, demo) : "__skip__";
  const constraints: QueryConstraint[] = [orderBy("name", "asc")];
  const { data, loading, error } = useRealtimeCollection<Template>(path, constraints);
  return { templates: data, loading, error };
}
