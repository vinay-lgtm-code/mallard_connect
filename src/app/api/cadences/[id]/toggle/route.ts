import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { isCadencesTemplatesEnabledServer } from "@/lib/feature-flags";
import { verifyToken, authError } from "@/lib/auth/verify-token";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  if (!isCadencesTemplatesEnabledServer()) {
    return NextResponse.json({ error: "Feature not enabled" }, { status: 403 });
  }

  const result = await verifyToken(request, { requireRole: ["admin", "manager"] });
  if (!result.ok) return authError(result);
  const { auth } = result;

  const { id } = await params;
  const supabase = createServiceClient();

  const { data: current, error: fetchError } = await supabase
    .from("cadences")
    .select("is_active")
    .eq("id", id)
    .eq("tenant_id", auth.tenantId)
    .single();

  if (fetchError || !current) {
    return NextResponse.json({ error: "Cadence not found" }, { status: 404 });
  }

  const { data, error } = await supabase
    .from("cadences")
    .update({ is_active: !current.is_active, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("tenant_id", auth.tenantId)
    .select("is_active")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Failed to toggle cadence" }, { status: 500 });
  }

  return NextResponse.json({ isActive: data.is_active });
}
