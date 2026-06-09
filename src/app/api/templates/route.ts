import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import { CreateTemplateSchema } from "@/schemas/template";
import { extractVariables } from "@/lib/email/render";
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

export async function GET(request: NextRequest) {
  if (!isCadencesTemplatesEnabledServer()) {
    return NextResponse.json({ error: "Feature not enabled" }, { status: 403 });
  }

  const auth = await verifyToken(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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

  const auth = await verifyToken(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (auth.role !== "admin" && auth.role !== "manager") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

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
