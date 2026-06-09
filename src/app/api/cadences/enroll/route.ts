import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { maybeEnrollOnStageChange } from "@/lib/cadences/triggers";
import { isCadencesTemplatesEnabledServer } from "@/lib/feature-flags";

export async function POST(request: NextRequest) {
  if (!isCadencesTemplatesEnabledServer()) {
    return NextResponse.json({ error: "Cadences feature is not enabled" }, { status: 403 });
  }

  let body: { leadId?: string; stageId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { leadId, stageId } = body;
  if (!leadId || !stageId) {
    return NextResponse.json({ error: "leadId, stageId required" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("users")
    .select("tenant_id")
    .eq("id", user.id)
    .single();

  if (!profile?.tenant_id) {
    return NextResponse.json({ error: "No tenant" }, { status: 403 });
  }

  const tenantId = profile.tenant_id as string;

  const { data: lead } = await supabase
    .from("leads")
    .select("id")
    .eq("id", leadId)
    .eq("tenant_id", tenantId)
    .single();

  if (!lead) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  try {
    await maybeEnrollOnStageChange(supabase, leadId, stageId, tenantId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
