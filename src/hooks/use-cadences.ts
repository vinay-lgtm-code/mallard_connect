"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useSupabase, isSupabaseConfigured } from "@/hooks/use-supabase";
import { isDemoUser, getMockCadences, getMockEnrollments } from "@/lib/mock-data";
import { rowsToApp } from "@/lib/supabase/mappers";
import type { Cadence, CadenceEnrollment } from "@/types";

export function useCadences() {
  const { user } = useAuth();
  const supabase = useSupabase();
  const demo = user ? isDemoUser(user.id) : false;
  const useMock = demo && !isSupabaseConfigured;
  const tenantId = user?.tenantId;

  const [data, setData] = useState<(Cadence & { id: string })[]>([]);
  const [loading, setLoading] = useState(!useMock);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (useMock || !supabase || !tenantId) return;
    supabase
      .from("cadences")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("name", { ascending: true })
      .then(({ data: rows, error: err }) => {
        if (err) { setError(new Error(err.message)); }
        else { setData(rowsToApp<Cadence & { id: string }>(rows ?? [])); }
        setLoading(false);
      });
  }, [supabase, tenantId, useMock]);

  if (useMock) {
    return { cadences: getMockCadences() as (Cadence & { id: string })[], loading: false, error: null };
  }

  return { cadences: data, loading, error };
}

export function useCadenceEnrollments(cadenceId?: string) {
  const { user } = useAuth();
  const supabase = useSupabase();
  const demo = user ? isDemoUser(user.id) : false;
  const useMock = demo && !isSupabaseConfigured;
  const tenantId = user?.tenantId;

  const [data, setData] = useState<(CadenceEnrollment & { id: string })[]>([]);
  const [loading, setLoading] = useState(!useMock);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (useMock || !supabase || !tenantId) return;

    let query = supabase
      .from("cadence_enrollments")
      .select("*")
      .eq("tenant_id", tenantId);

    if (cadenceId) query = query.eq("cadence_id", cadenceId);

    query.then(({ data: rows, error: err }) => {
      if (err) { setError(new Error(err.message)); }
      else { setData(rowsToApp<CadenceEnrollment & { id: string }>(rows ?? [])); }
      setLoading(false);
    });
  }, [supabase, tenantId, cadenceId, useMock]);

  if (useMock) {
    let enrollments = getMockEnrollments() as (CadenceEnrollment & { id: string })[];
    if (cadenceId) enrollments = enrollments.filter((e) => e.cadenceId === cadenceId);
    return { enrollments, loading: false, error: null };
  }

  return { enrollments: data, loading, error };
}
