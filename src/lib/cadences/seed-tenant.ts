import { STARTER_CADENCES } from "./seeds";
import { SEEDED_TEMPLATES } from "@/lib/mock-data/cadences-seed";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function seedTenantCadencesAndTemplates(
  supabase: SupabaseClient,
  tenantId: string
): Promise<{ seeded: boolean; skipped: boolean }> {
  // Fix: check BOTH tables for idempotency. If either has data, skip.
  // Prevents duplicate template inserts if a previous call crashed
  // between template insertion and cadence insertion.
  const { count: cadenceCount } = await supabase
    .from("cadences")
    .select("*", { count: "exact", head: true })
    .eq("tenant_id", tenantId);

  const { count: templateCount } = await supabase
    .from("templates")
    .select("*", { count: "exact", head: true })
    .eq("tenant_id", tenantId);

  if ((cadenceCount ?? 0) > 0 || (templateCount ?? 0) > 0) {
    return { seeded: false, skipped: true };
  }

  // Batch-insert all templates in a single round-trip
  const templateRows = SEEDED_TEMPLATES.map((tpl) => ({
    tenant_id: tenantId,
    name: tpl.name,
    channel: tpl.channel,
    subject: tpl.subject ?? null,
    body: tpl.body,
    variables: tpl.variables,
  }));

  const { data: insertedTemplates, error: tplErr } = await supabase
    .from("templates")
    .insert(templateRows)
    .select("id, name");

  if (tplErr || !insertedTemplates) throw tplErr ?? new Error("Template insert failed");

  // Build slug-to-UUID map by matching template name back to original slug
  const nameToSlug = new Map(SEEDED_TEMPLATES.map((t) => [t.name, t.id]));
  const slugToUuid = new Map<string, string>();
  for (const row of insertedTemplates) {
    const slug = nameToSlug.get(row.name);
    if (slug) slugToUuid.set(slug, row.id);
  }

  // Batch-insert all cadences in a single round-trip
  const cadenceRows = STARTER_CADENCES.map((cadence) => ({
    tenant_id: tenantId,
    name: cadence.name,
    description: cadence.description ?? null,
    trigger: cadence.trigger,
    steps: cadence.steps.map((step) => ({
      ...step,
      templateId: step.templateId
        ? slugToUuid.get(step.templateId) ?? step.templateId
        : undefined,
    })),
    is_active: cadence.isActive,
  }));

  const { error: cadErr } = await supabase.from("cadences").insert(cadenceRows);
  if (cadErr) throw cadErr;

  return { seeded: true, skipped: false };
}
