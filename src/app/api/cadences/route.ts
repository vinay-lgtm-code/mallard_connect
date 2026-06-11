import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import { CreateCadenceSchema } from "@/schemas/cadence";
import { isCadencesTemplatesEnabledServer } from "@/lib/feature-flags";
import { verifyToken, authError } from "@/lib/auth/verify-token";

export async function GET(request: NextRequest) {
  if (!isCadencesTemplatesEnabledServer()) {
    return NextResponse.json({ error: "Feature not enabled" }, { status: 403 });
  }

  const result = await verifyToken(request);
  if (!result.ok) return authError(result);
  const { auth } = result;

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("cadences")
    .select("*")
    .eq("tenant_id", auth.tenantId)
    .order("name", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  if (!isCadencesTemplatesEnabledServer()) {
    return NextResponse.json({ error: "Feature not enabled" }, { status: 403 });
  }

  const result = await verifyToken(request, { requireRole: ["admin", "manager"] });
  if (!result.ok) return authError(result);
  const { auth } = result;

  let validated;
  try {
    const body = await request.json();
    validated = CreateCadenceSchema.parse(body);
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json({ error: "Validation failed", issues: err.issues }, { status: 400 });
    }
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const templateIds = validated.steps
    .map((s) => s.templateId)
    .filter((id): id is string => !!id);

  if (templateIds.length > 0) {
    const supabase = createServiceClient();
    const { data: templates } = await supabase
      .from("templates")
      .select("id")
      .eq("tenant_id", auth.tenantId)
      .in("id", templateIds);

    const foundIds = new Set((templates ?? []).map((t) => t.id));
    const invalidIds = templateIds.filter((id) => !foundIds.has(id));

    if (invalidIds.length > 0) {
      return NextResponse.json(
        { error: "Invalid template references", invalidTemplateIds: invalidIds },
        { status: 400 },
      );
    }
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("cadences")
    .insert({
      tenant_id: auth.tenantId,
      name: validated.name,
      description: validated.description ?? null,
      trigger: validated.trigger,
      steps: validated.steps,
      is_active: validated.isActive,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
