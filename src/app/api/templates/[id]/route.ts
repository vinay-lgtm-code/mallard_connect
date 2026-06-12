import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import { UpdateTemplateSchema } from "@/schemas/template";
import { extractVariables } from "@/lib/email/render";
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
    .from("templates")
    .select("*")
    .eq("id", id)
    .eq("tenant_id", auth.tenantId)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
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
    validated = UpdateTemplateSchema.parse(body);
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json({ error: "Validation failed", issues: err.issues }, { status: 400 });
    }
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const update: Record<string, unknown> = {};
  if ("name" in validated && validated.name !== undefined) update.name = validated.name;
  if ("channel" in validated && validated.channel !== undefined) update.channel = validated.channel;
  if ("subject" in validated && validated.subject !== undefined) update.subject = validated.subject;
  if ("body" in validated && validated.body !== undefined) update.body = validated.body;

  if ("body" in validated || "subject" in validated) {
    const supabase = createServiceClient();
    const { data: current } = await supabase
      .from("templates")
      .select("subject, body")
      .eq("id", id)
      .eq("tenant_id", auth.tenantId)
      .single();

    if (!current) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    const finalSubject = "subject" in validated ? (validated.subject ?? "") : (current.subject ?? "");
    const finalBody = "body" in validated ? (validated.body ?? current.body) : current.body;
    const combinedText = [finalSubject, finalBody].filter(Boolean).join(" ");
    update.variables = extractVariables(combinedText);
  }

  update.updated_at = new Date().toISOString();

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("templates")
    .update(update)
    .eq("id", id)
    .eq("tenant_id", auth.tenantId)
    .select()
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
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

  const { data: cadences } = await supabase
    .from("cadences")
    .select("id, name, steps")
    .eq("tenant_id", auth.tenantId);

  if (cadences) {
    const referencingCadences = cadences.filter((cadence) => {
      const steps = cadence.steps as Array<{ templateId?: string }>;
      return Array.isArray(steps) && steps.some((step) => step.templateId === id);
    });

    if (referencingCadences.length > 0) {
      return NextResponse.json(
        {
          error: "Template is in use",
          cadences: referencingCadences.map((c) => c.name),
        },
        { status: 409 },
      );
    }
  }

  const { error } = await supabase
    .from("templates")
    .delete()
    .eq("id", id)
    .eq("tenant_id", auth.tenantId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
