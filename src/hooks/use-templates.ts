"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useSupabase } from "@/hooks/use-supabase";
import { isDemoUser, getMockTemplates } from "@/lib/mock-data";
import { rowsToApp } from "@/lib/supabase/mappers";
import type { Template } from "@/types";

export function useTemplates() {
  const { user } = useAuth();
  const supabase = useSupabase();
  const demo = user ? isDemoUser(user.id) : false;
  const useMock = demo;
  const tenantId = user?.tenantId;

  const [data, setData] = useState<(Template & { id: string })[]>([]);
  const [loading, setLoading] = useState(!useMock);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (useMock || !supabase || !tenantId) return;
    supabase
      .from("templates")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("name", { ascending: true })
      .then(({ data: rows, error: err }) => {
        if (err) { setError(new Error(err.message)); }
        else { setData(rowsToApp<Template & { id: string }>(rows ?? [])); }
        setLoading(false);
      });
  }, [supabase, tenantId, useMock]);

  if (useMock) {
    return { templates: getMockTemplates() as (Template & { id: string })[], loading: false, error: null };
  }

  return { templates: data, loading, error };
}
