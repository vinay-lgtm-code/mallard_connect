"use client";

import { useMemo } from "react";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";

export function useSupabase() {
  const client = useMemo(() => {
    if (!isSupabaseConfigured) return null;
    return createClient();
  }, []);
  return client;
}

export { isSupabaseConfigured };
