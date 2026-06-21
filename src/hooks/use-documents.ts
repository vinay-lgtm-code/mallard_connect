"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useSupabase } from "@/hooks/use-supabase";
import { isDemoUser } from "@/lib/mock-data";
import { rowsToApp } from "@/lib/supabase/mappers";
import type { Document } from "@/types";

const MOCK_DOCUMENTS: (Document & { id: string })[] = [];

export function useLeadDocuments(leadId: string) {
  const { user } = useAuth();
  const supabase = useSupabase();
  const demo = user ? isDemoUser(user.id) : false;
  const useMock = demo;
  const tenantId = user?.tenantId;

  const [data, setData] = useState<(Document & { id: string })[]>([]);
  const [loading, setLoading] = useState(!useMock);
  const [error, setError] = useState<Error | null>(null);

  const refetch = useCallback(() => {
    if (!supabase || !tenantId || useMock) return;
    setLoading(true);
    supabase
      .from("documents")
      .select("*")
      .eq("lead_id", leadId)
      .eq("tenant_id", tenantId)
      .eq("is_archived", false)
      .order("created_at", { ascending: false })
      .then(({ data: rows, error: err }) => {
        if (err) { setError(new Error(err.message)); }
        else { setData(rowsToApp<Document & { id: string }>(rows ?? [])); }
        setLoading(false);
      });
  }, [supabase, tenantId, leadId, useMock]);

  useEffect(() => { refetch(); }, [refetch]);

  if (useMock) {
    return { documents: MOCK_DOCUMENTS, loading: false, error: null, refetch };
  }

  return { documents: data, loading, error, refetch };
}
