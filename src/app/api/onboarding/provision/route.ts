import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { seedTenantCadencesAndTemplates } from "@/lib/cadences/seed-tenant";

export async function POST(request: NextRequest) {
  let body: {
    uid?: string;
    firmName?: string;
    slug?: string;
    primaryColor?: string;
    seatLimit?: number;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { uid, firmName, slug, primaryColor, seatLimit } = body;
  if (!uid || !firmName || !slug) {
    return NextResponse.json({ error: "uid, firmName, slug are required" }, { status: 400 });
  }
  if (!/^[a-z0-9-]+$/.test(slug)) {
    return NextResponse.json({ error: "Slug must be lowercase alphanumeric with dashes" }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { data: existingTenant } = await supabase
    .from("tenants")
    .select("id")
    .eq("slug", slug)
    .single();

  if (existingTenant) {
    return NextResponse.json({ error: "That vanity URL is already taken" }, { status: 409 });
  }

  const { data: tenant, error: tenantErr } = await supabase.from("tenants").insert({
    name: firmName,
    slug,
    primary_color: primaryColor ?? "#1A5653",
    plan: "trial",
    seat_limit: seatLimit ?? 5,
  }).select("id").single();

  if (tenantErr || !tenant) {
    return NextResponse.json({ error: tenantErr?.message ?? "Failed to create tenant" }, { status: 500 });
  }

  await supabase.auth.admin.updateUserById(uid, {
    app_metadata: { role: "manager", tenant_id: tenant.id },
  });

  await supabase.from("users").upsert({
    id: uid,
    tenant_id: tenant.id,
    email: "",
    full_name: "",
    role: "manager",
  }, { onConflict: "id" });

  try {
    await seedTenantCadencesAndTemplates(supabase, tenant.id);
  } catch (e) {
    console.error("Cadence seed failed (non-blocking):", e);
  }

  return NextResponse.json({ tenantId: tenant.id, slug }, { status: 201 });
}
