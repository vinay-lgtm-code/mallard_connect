"use client";

import { createClient } from "@/lib/supabase/client";

async function getAccessToken(): Promise<string | null> {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

export async function notifyAssignment(leadId: string): Promise<void> {
  const token = await getAccessToken();
  if (!token) return;

  fetch("/api/notifications/assignment", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ leadId }),
  }).catch(() => {});
}
