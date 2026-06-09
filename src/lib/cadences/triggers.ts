import type { SupabaseClient } from "@supabase/supabase-js";

export async function maybeEnrollOnStageChange(
  supabase: SupabaseClient,
  leadId: string,
  newStageId: string,
  tenantId: string,
): Promise<void> {
  if (process.env.NEXT_PUBLIC_ENABLE_CADENCES_TEMPLATES !== "true") return;

  const { data: cadences } = await supabase
    .from("cadences")
    .select("id, trigger, steps")
    .eq("tenant_id", tenantId)
    .eq("is_active", true);

  if (!cadences || cadences.length === 0) return;

  const matching = cadences.filter((c) => {
    const trigger = c.trigger as { type: string; stageId?: string };
    return trigger.type === "stage_entered" && trigger.stageId === newStageId;
  });

  // Batch-check for existing enrollments instead of querying one cadence at a time
  const matchingIds = matching.map((c) => c.id);
  const { data: existingEnrollments } = await supabase
    .from("cadence_enrollments")
    .select("cadence_id")
    .eq("lead_id", leadId)
    .in("cadence_id", matchingIds)
    .in("status", ["active", "paused"]);

  const alreadyEnrolled = new Set((existingEnrollments ?? []).map((e) => e.cadence_id as string));

  for (const cadence of matching) {
    if (alreadyEnrolled.has(cadence.id)) continue;

    const steps = cadence.steps as { delayDays: number }[];
    const firstDelay = steps[0]?.delayDays ?? 0;
    const nextRunAt = new Date(Date.now() + firstDelay * 24 * 60 * 60 * 1000).toISOString();

    await supabase.from("cadence_enrollments").insert({
      tenant_id: tenantId,
      lead_id: leadId,
      cadence_id: cadence.id,
      current_step: 0,
      next_run_at: nextRunAt,
      status: "active",
    });
  }
}
