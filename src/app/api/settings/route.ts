import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { verifyToken, authError } from "@/lib/auth/verify-token";

export async function GET(request: NextRequest) {
  const result = await verifyToken(request);
  if (!result.ok) return authError(result);
  const { auth } = result;

  const supabase = createServiceClient();

  const [userRes, stagesRes] = await Promise.all([
    supabase.from("users").select("full_name, email, phone, notification_preferences").eq("id", auth.uid).single(),
    supabase.from("pipeline_stages").select("*").eq("tenant_id", auth.tenantId).order("position"),
  ]);

  const userData = userRes.data ?? {};

  return NextResponse.json({
    user: {
      fullName: (userData as Record<string, unknown>).full_name ?? "",
      email: (userData as Record<string, unknown>).email ?? "",
      phone: (userData as Record<string, unknown>).phone ?? null,
      notificationPreferences: (userData as Record<string, unknown>).notification_preferences ?? null,
    },
    stages: stagesRes.data ?? [],
  });
}

export async function PATCH(request: NextRequest) {
  const result = await verifyToken(request);
  if (!result.ok) return authError(result);
  const { auth } = result;

  const body = await request.json();
  const supabase = createServiceClient();

  const update: Record<string, unknown> = {};
  if ("fullName" in body) update.full_name = body.fullName;
  if ("phone" in body) update.phone = body.phone;
  if ("notificationPreferences" in body) update.notification_preferences = body.notificationPreferences;

  if (Object.keys(update).length > 0) {
    await supabase.from("users").update(update).eq("id", auth.uid);
  }

  return NextResponse.json({ success: true });
}

export async function POST(request: NextRequest) {
  const result = await verifyToken(request, { requireRole: ["admin", "manager"] });
  if (!result.ok) return authError(result);
  const { auth } = result;

  const body = await request.json();
  const supabase = createServiceClient();
  const { action } = body;

  if (action === "add") {
    const { name, color, position } = body;
    if (!name || !color || position === undefined) {
      return NextResponse.json({ error: "name, color, and position are required" }, { status: 400 });
    }
    const slug = name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    const { data } = await supabase.from("pipeline_stages").insert({
      tenant_id: auth.tenantId,
      name, slug, color,
      position: Number(position),
      is_terminal: false,
    }).select("id").single();

    return NextResponse.json({ success: true, id: data?.id });
  }

  if (action === "update") {
    const { stageId, name, color, position } = body;
    if (!stageId) return NextResponse.json({ error: "stageId is required" }, { status: 400 });

    const update: Record<string, unknown> = {};
    if (name !== undefined) update.name = name;
    if (color !== undefined) update.color = color;
    if (position !== undefined) update.position = Number(position);

    await supabase.from("pipeline_stages").update(update).eq("id", stageId).eq("tenant_id", auth.tenantId);
    return NextResponse.json({ success: true });
  }

  if (action === "reorder") {
    const { order } = body as { order: { id: string; position: number }[] };
    if (!Array.isArray(order)) {
      return NextResponse.json({ error: "order array is required" }, { status: 400 });
    }
    for (const item of order) {
      await supabase.from("pipeline_stages").update({ position: item.position }).eq("id", item.id).eq("tenant_id", auth.tenantId);
    }
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
