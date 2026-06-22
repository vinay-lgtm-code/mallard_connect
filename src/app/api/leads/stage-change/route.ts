import { NextRequest, NextResponse } from "next/server";
import { authError, verifyToken } from "@/lib/auth/verify-token";
import { createServiceClient } from "@/lib/supabase/server";
import { getDefaultPipelineStage } from "@/lib/pipeline-stages";

type StageRow = {
  id: string;
  slug: string;
  name: string;
  is_terminal: boolean;
};

async function resolveStage(
  supabase: ReturnType<typeof createServiceClient>,
  tenantId: string,
  stageSlug: string,
): Promise<StageRow | null> {
  const { data: existing, error: existingError } = await supabase
    .from("pipeline_stages")
    .select("id, slug, name, is_terminal")
    .eq("tenant_id", tenantId)
    .eq("slug", stageSlug)
    .maybeSingle();

  if (existingError) throw existingError;
  if (existing) return existing as StageRow;

  const definition = getDefaultPipelineStage(stageSlug);
  if (!definition) return null;

  const { data: inserted, error: insertError } = await supabase
    .from("pipeline_stages")
    .insert({
      tenant_id: tenantId,
      name: definition.name,
      slug: definition.slug,
      position: definition.position,
      color: definition.color,
      is_terminal: definition.isTerminal,
    })
    .select("id, slug, name, is_terminal")
    .single();

  if (!insertError) return inserted as StageRow;

  // Another request may have inserted it between the read and insert.
  const { data: raced, error: racedError } = await supabase
    .from("pipeline_stages")
    .select("id, slug, name, is_terminal")
    .eq("tenant_id", tenantId)
    .eq("slug", stageSlug)
    .maybeSingle();

  if (racedError) throw racedError;
  return (raced as StageRow | null) ?? null;
}

export async function POST(request: NextRequest) {
  const result = await verifyToken(request);
  if (!result.ok) return authError(result);
  const auth = result.auth;

  let body: { leadId?: string; stageSlug?: string; note?: string | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const leadId = body.leadId?.trim();
  const stageSlug = body.stageSlug?.trim();
  if (!leadId || !stageSlug) {
    return NextResponse.json({ error: "leadId and stageSlug are required" }, { status: 400 });
  }

  const supabase = createServiceClient();

  try {
    const stage = await resolveStage(supabase, auth.tenantId, stageSlug);
    if (!stage) {
      return NextResponse.json({ error: "Unknown pipeline stage" }, { status: 400 });
    }

    const nowIso = new Date().toISOString();
    const leadUpdate: Record<string, unknown> = {
      current_stage_id: stage.id,
      current_stage_entered_at: nowIso,
      updated_at: nowIso,
    };
    if (stage.is_terminal) {
      leadUpdate.status = "converted";
      leadUpdate.converted_at = nowIso;
    }

    const { error: leadError } = await supabase
      .from("leads")
      .update(leadUpdate)
      .eq("id", leadId)
      .eq("tenant_id", auth.tenantId);
    if (leadError) throw leadError;

    const { error: closeHistoryError } = await supabase
      .from("lead_stage_history")
      .update({ exited_at: nowIso })
      .eq("lead_id", leadId)
      .eq("tenant_id", auth.tenantId)
      .is("exited_at", null);
    if (closeHistoryError) {
      console.error("Failed to close lead stage history:", closeHistoryError);
    }

    const { error: historyError } = await supabase.from("lead_stage_history").insert({
      tenant_id: auth.tenantId,
      lead_id: leadId,
      stage_id: stage.id,
      stage_slug: stage.slug,
      entered_at: nowIso,
    });
    if (historyError) {
      console.error("Failed to insert lead stage history:", historyError);
    }

    const { error: activityError } = await supabase.from("activities").insert({
      tenant_id: auth.tenantId,
      lead_id: leadId,
      performed_by: auth.uid,
      activity_type: "stage-change",
      title: `Stage changed to ${stage.name}`,
      description: body.note || null,
      metadata: null,
    });
    if (activityError) {
      console.error("Failed to insert stage-change activity:", activityError);
    }

    return NextResponse.json({
      stage: {
        id: stage.id,
        slug: stage.slug,
        name: stage.name,
        isTerminal: stage.is_terminal,
      },
      updatedAt: nowIso,
    });
  } catch (error) {
    console.error("Failed to change lead stage:", error);
    return NextResponse.json({ error: "Failed to change lead stage" }, { status: 500 });
  }
}
