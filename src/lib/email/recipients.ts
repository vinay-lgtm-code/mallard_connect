import type { SupabaseClient } from "@supabase/supabase-js";

export type NotificationPref = "reminders" | "assignments" | "stageChanges";

export interface NotificationPreferences {
  reminders: boolean;
  assignments: boolean;
  stageChanges: boolean;
}

export const PREF_DEFAULTS: NotificationPreferences = {
  reminders: true,
  assignments: true,
  stageChanges: false,
};

export function getLeadName(lead: { first_name?: string | null; last_name?: string | null }): string {
  return `${lead.first_name ?? ""} ${lead.last_name ?? ""}`.trim() || "Unknown";
}

export async function getManagerEmails(
  supabase: SupabaseClient,
  tenantId: string,
  pref?: NotificationPref,
): Promise<string[]> {
  const query = supabase
    .from("users")
    .select("email, notification_preferences")
    .eq("tenant_id", tenantId)
    .in("role", ["admin", "manager"])
    .eq("is_active", true);

  const { data: managers } = await query;
  if (!managers) return [];

  return managers
    .filter((m) => {
      if (!pref) return true;
      const prefs = (m.notification_preferences ?? {}) as Partial<NotificationPreferences>;
      return prefs[pref] ?? PREF_DEFAULTS[pref];
    })
    .map((m) => m.email as string)
    .filter(Boolean);
}

export async function filterRecipientsByPref(
  supabase: SupabaseClient,
  tenantId: string,
  emails: string[],
  pref: NotificationPref,
): Promise<string[]> {
  if (emails.length === 0) return [];

  const { data: tenantUsers } = await supabase
    .from("users")
    .select("email, notification_preferences")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .in("email", emails);

  const tenantEmailSet = new Set((tenantUsers ?? []).map((u) => u.email as string));
  const optedOutSet = new Set(
    (tenantUsers ?? [])
      .filter((u) => {
        const prefs = (u.notification_preferences ?? {}) as Partial<NotificationPreferences>;
        return (prefs[pref] ?? PREF_DEFAULTS[pref]) === false;
      })
      .map((u) => u.email as string),
  );

  return emails.filter((email) => {
    if (!tenantEmailSet.has(email)) return true;
    return !optedOutSet.has(email);
  });
}
