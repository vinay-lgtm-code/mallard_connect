import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import { UpdateCadenceSchema } from "@/schemas/cadence";
import { isCadencesTemplatesEnabledServer } from "@/lib/feature-flags";

async function verifyToken(request: NextRequest) {
  const supabase = createServiceClient();
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return null;

  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) return null;

  const { data: profile } = await supabase
    .from("users")
    .select("role, tenant_id")
    .eq("id", user.id)
    .single();

  return profile ? { uid: user.id, role: profile.role as string, tenantId: profile.tenant_id as string } : null;
}

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: RouteContext) {
  if (!isCadencesTemplatesEnabledServer()) {
    return NextResponse.json({ error: "Feature not enabled" }, { status: 403 });
  }

  const auth = await verifyToken(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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

  const auth = await verifyToken(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (auth.role !== "admin" && auth.role !== "manager") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

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

  // Validate templateId references if steps were provided
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

  // Build update object with only provided fields
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

  const auth = await verifyToken(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (auth.role !== "admin" && auth.role !== "manager") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const supabase = createServiceClient();

  // Verify cadence belongs to this tenant before touching enrollments
  const { data: cadence } = await supabase
    .from("cadences")
    .select("id")
    .eq("id", id)
    .eq("tenant_id", auth.tenantId)
    .single();

  if (!cadence) {
    return NextResponse.json({ error: "Cadence not found" }, { status: 404 });
  }

  // Check for active enrollments (tenant-scoped)
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

  // Delete all enrollments first (FK has no CASCADE, tenant-scoped)
  await supabase
    .from("cadence_enrollments")
    .delete()
    .eq("cadence_id", id)
    .eq("tenant_id", auth.tenantId);

  // Delete the cadence
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
