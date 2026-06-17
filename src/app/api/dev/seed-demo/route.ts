import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { appToRow } from "@/lib/supabase/mappers";
import { seedTenantCadencesAndTemplates } from "@/lib/cadences/seed-tenant";
import { requireCronAuth } from "@/lib/cron/auth";
import * as mallard from "@/lib/mock-data/mallard";
import * as friendsCapital from "@/lib/mock-data/friends-capital";
import * as acme from "@/lib/mock-data/acme";

const TENANT_IDS: Record<string, string> = {
  mallard: "00000000-0000-0000-0000-000000000001",
  "friends-capital": "00000000-0000-0000-0000-000000000002",
  acme: "00000000-0000-0000-0000-000000000003",
};

const SEEDS = {
  mallard,
  "friends-capital": friendsCapital,
  acme,
} as const;

type Slug = keyof typeof SEEDS;

export async function POST(request: NextRequest) {
  const authError = requireCronAuth(request);
  if (authError) return authError;

  const url = new URL(request.url);
  const slugParam = url.searchParams.get("slug");
  const slugsToSeed: Slug[] = slugParam && slugParam in SEEDS
    ? [slugParam as Slug]
    : (Object.keys(SEEDS) as Slug[]);

  const supabase = createServiceClient();
  const results: Record<string, { ok: boolean; error?: string }> = {};

  for (const slug of slugsToSeed) {
    const tenantId = TENANT_IDS[slug];
    const data = SEEDS[slug];

    try {
      // Seed leads
      for (const lead of data.leads) {
        const row = appToRow(lead);
        delete row.created_at;
        delete row.updated_at;
        delete row.converted_at;
        delete row.lost_at;
        await supabase.from("leads").upsert({
          ...row,
          tenant_id: tenantId,
          id: lead.id,
        }, { onConflict: "id" });
      }

      // Seed tasks
      for (const task of data.tasks) {
        const row = appToRow(task);
        delete row.created_at;
        await supabase.from("tasks").upsert({
          ...row,
          tenant_id: tenantId,
          id: task.id,
        }, { onConflict: "id" });
      }

      // Seed activities
      for (const act of data.activities) {
        const row = appToRow(act);
        delete row.created_at;
        await supabase.from("activities").upsert({
          ...row,
          tenant_id: tenantId,
          id: act.id,
        }, { onConflict: "id" });
      }

      // Seed cadences + templates (idempotent — skips if already present)
      await seedTenantCadencesAndTemplates(supabase, tenantId);

      results[slug] = { ok: true };
    } catch (err) {
      results[slug] = { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  return NextResponse.json({ seeded: results });
}

export const GET = POST;
