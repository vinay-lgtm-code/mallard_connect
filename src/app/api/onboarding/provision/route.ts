import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { seedTenantCadencesAndTemplates } from "@/lib/cadences/seed-tenant";
import {
  findActiveProvisionByEmail,
  findProvisionByClaimToken,
  isProvisionedPocEmail,
} from "@/lib/provisioning/organization-provisions";

const DEFAULT_STAGES = [
  { name: "New Enquiry", slug: "new_enquiry", position: 0, color: "#6366f1", is_terminal: false },
  { name: "Initial Contact", slug: "initial_contact", position: 1, color: "#3b82f6", is_terminal: false },
  { name: "Not proceeded.", slug: "not_ready_yet", position: 2, color: "#f59e0b", is_terminal: false },
  { name: "Nurturing", slug: "nurturing", position: 3, color: "#22c55e", is_terminal: false },
  { name: "Decision in Principle done", slug: "decision_in_principle_done", position: 4, color: "#14b8a6", is_terminal: false },
  { name: "Ready to proceed", slug: "ready_to_proceed", position: 5, color: "#2563eb", is_terminal: false },
  { name: "Deal Done", slug: "referred_to_mab", position: 6, color: "#a855f7", is_terminal: true },
];

const DEFAULT_SOURCES = [
  { name: "Website", slug: "website" },
  { name: "Referral", slug: "referral" },
  { name: "Phone", slug: "phone" },
  { name: "Social Media", slug: "social" },
  { name: "Other", slug: "other" },
];

export async function POST(request: NextRequest) {
  let body: {
    firmName?: string;
    slug?: string;
    primaryColor?: string;
    seatLimit?: number;
    claimToken?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { firmName, slug, primaryColor, seatLimit, claimToken } = body;
  if (!firmName || !slug) {
    return NextResponse.json({ error: "firmName and slug are required" }, { status: 400 });
  }
  if (!/^[a-z0-9-]+$/.test(slug)) {
    return NextResponse.json({ error: "Slug must be lowercase alphanumeric with dashes" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 401 });
  }

  const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !authUser?.email) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  const provision = claimToken
    ? await findProvisionByClaimToken(supabase, claimToken)
    : await findActiveProvisionByEmail(supabase, authUser.email);

  if (!provision || provision.status !== "provisioned" || !isProvisionedPocEmail(provision, authUser.email)) {
    return NextResponse.json(
      { error: "This workspace can only be created by the provisioned organization contact." },
      { status: 403 },
    );
  }

  const { data: existingTenant } = await supabase
    .from("tenants")
    .select("id")
    .eq("slug", slug)
    .single();

  if (existingTenant) {
    return NextResponse.json({ error: "That vanity URL is already taken" }, { status: 409 });
  }

  const { data: tenant, error: tenantErr } = await supabase
    .from("tenants")
    .insert({
      name: firmName,
      slug,
      primary_color: primaryColor ?? "#1A5653",
      plan: "trial",
      seat_limit: seatLimit ?? 5,
    })
    .select("id")
    .single();

  if (tenantErr || !tenant) {
    return NextResponse.json(
      { error: tenantErr?.message ?? "Failed to create tenant" },
      { status: 500 }
    );
  }

  const { data: claimedProvision, error: claimErr } = await supabase
    .from("organization_provisions")
    .update({
      tenant_id: tenant.id,
      status: "claimed",
      claimed_at: new Date().toISOString(),
      updated_by_email: authUser.email,
    })
    .eq("id", provision.id)
    .eq("status", "provisioned")
    .is("tenant_id", null)
    .select("id")
    .maybeSingle();

  if (claimErr || !claimedProvision) {
    await supabase.from("tenants").delete().eq("id", tenant.id);
    return NextResponse.json(
      { error: claimErr?.message ?? "This organization has already been claimed" },
      { status: 409 },
    );
  }

  await supabase.auth.admin.updateUserById(authUser.id, {
    app_metadata: { role: "manager", tenant_id: tenant.id },
  });

  await supabase.from("users").upsert(
    {
      id: authUser.id,
      tenant_id: tenant.id,
      email: authUser?.email ?? "",
      full_name: (authUser?.user_metadata?.full_name as string) ?? "",
      role: "manager",
    },
    { onConflict: "id" }
  );

  await supabase
    .from("pipeline_stages")
    .insert(DEFAULT_STAGES.map((s) => ({ ...s, tenant_id: tenant.id })));

  await supabase
    .from("lead_sources")
    .insert(DEFAULT_SOURCES.map((s) => ({ ...s, tenant_id: tenant.id })));

  try {
    await seedTenantCadencesAndTemplates(supabase, tenant.id);
  } catch (e) {
    console.error("Cadence seed failed (non-blocking):", e);
  }

  return NextResponse.json({ tenantId: tenant.id, slug }, { status: 201 });
}
