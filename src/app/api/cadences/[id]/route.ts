import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import { UpdateCadenceSchema } from "@/schemas/cadence";
import { isCadencesTemplatesEnabledServer } from "@/lib/feature-flags";
import { verifyToken, authError } from "@/lib/auth/verify-token";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: RouteContext) {
  if (!isCadencesTemplatesEnabledServer()) {
    return NextResponse.json({ error: "Feature not enabled" }, { status: 403 });
  }

  const result = await verifyToken(request);
  if (!result.ok) return authError(result);
  const { auth } = result;

  const { id } = await params;
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("cadences")
    .select("*")
    .eq("id", id)
    .eq("tenant_id", auth.tenantId)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Cadence not found" }, { status: 404 });
  }

  return NextResponse.json(data);
}

export async function PUT(request: NextRequest, { params }: RouteContext) {
  if (!isCadencesTemplatesEnabledServer()) {
    return NextResponse.json({ error: "Feature not enabled" }, { status: 403 });
  }

  const result = await verifyToken(request, { requireRole: ["admin", "manager"] });
  if (!result.ok) return authError(result);
  const { auth } = result;

  const { id } = await params;

  let validated;
  try {
    const body = await request.json();
    validated = UpdateCadenceSchema.parse(body);
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json({ error: "Validation failed", issues: err.issues }, { status: 400 });
    }
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (validated.steps) {
    const templateIds = validated.steps
      .map((s) => s.templateId)
      .filter((tid): tid is string => !!tid);

    if (templateIds.length > 0) {
      const supabase = createServiceClient();
      const { data: templates } = await supabase
        .from("templates")
        .select("id")
        .eq("tenant_id", auth.tenantId)
        .in("id", templateIds);

      const foundIds = new Set((templates ?? []).map((t) => t.id));
      const invalidIds = templateIds.filter((tid) => !foundIds.has(tid));

      if (invalidIds.length > 0) {
        return NextResponse.json(
          { error: "Invalid template references", invalidTemplateIds: invalidIds },
          { status: 400 },
        );
      }
    }
  }

  const update: Record<string, unknown> = {};
  if ("name" in validated && validated.name !== undefined) update.name = validated.name;
  if ("description" in validated && validated.description !== undefined) update.description = validated.description;
  if ("trigger" in validated && validated.trigger !== undefined) update.trigger = validated.trigger;
  if ("steps" in validated && validated.steps !== undefined) update.steps = validated.steps;
  if ("isActive" in validated && validated.isActive !== undefined) update.is_active = validated.isActive;
  update.updated_at = new Date().toISOString();

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("cadences")
    .update(update)
    .eq("id", id)
    .eq("tenant_id", auth.tenantId)
    .select()
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Cadence not found" }, { status: 404 });
  }

  return NextResponse.json(data);
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  if (!isCadencesTemplatesEnabledServer()) {
    return NextResponse.json({ error: "Feature not enabled" }, { status: 403 });
  }

  const result = await verifyToken(request, { requireRole: ["admin", "manager"] });
  if (!result.ok) return authError(result);
  const { auth } = result;

  const { id } = await params;
  const supabase = createServiceClient();

  const { data: cadence } = await supabase
    .from("cadences")
    .select("id")
    .eq("id", id)
    .eq("tenant_id", auth.tenantId)
    .single();

  if (!cadence) {
    return NextResponse.json({ error: "Cadence not found" }, { status: 404 });
  }

  const { count } = await supabase
    .from("cadence_enrollments")
    .select("*", { count: "exact", head: true })
    .eq("cadence_id", id)
    .eq("tenant_id", auth.tenantId)
    .eq("status", "active");

  if (count && count > 0) {
    return NextResponse.json(
      { error: "Cadence has active enrollments", count },
      { status: 409 },
    );
  }

  await supabase
    .from("cadence_enrollments")
    .delete()
    .eq("cadence_id", id)
    .eq("tenant_id", auth.tenantId);

  const { error } = await supabase
    .from("cadences")
    .delete()
    .eq("id", id)
    .eq("tenant_id", auth.tenantId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
