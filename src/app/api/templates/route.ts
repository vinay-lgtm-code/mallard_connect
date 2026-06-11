import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import { CreateTemplateSchema } from "@/schemas/template";
import { extractVariables } from "@/lib/email/render";
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
    .from("templates")
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
    validated = CreateTemplateSchema.parse(body);
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json({ error: "Validation failed", issues: err.issues }, { status: 400 });
    }
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const combinedText = [validated.subject, validated.body].filter(Boolean).join(" ");
  const variables = extractVariables(combinedText);

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("templates")
    .insert({
      tenant_id: auth.tenantId,
      name: validated.name,
      channel: validated.channel,
      subject: validated.subject ?? null,
      body: validated.body,
      variables,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
