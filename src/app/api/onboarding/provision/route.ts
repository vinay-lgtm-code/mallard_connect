import { NextRequest, NextResponse } from "next/server";
import path from "node:path";
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

const LOGO_BUCKET = "tenant-logos";
const MAX_LOGO_SIZE = 2 * 1024 * 1024;
const LOGO_MIME_BY_EXTENSION: Record<string, string> = {
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};
const LOGO_EXTENSIONS_BY_MIME: Record<string, string> = {
  "image/svg+xml": "svg",
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

type ProvisionPayload = {
  firmName?: string;
  slug?: string;
  primaryColor?: string;
  seatLimit?: number;
  claimToken?: string;
  logoFile?: File | null;
};

function stringValue(value: FormDataEntryValue | null): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

async function parsePayload(request: NextRequest): Promise<ProvisionPayload | null> {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const logo = formData.get("logo");
    const seatLimit = stringValue(formData.get("seatLimit"));

    return {
      firmName: stringValue(formData.get("firmName")),
      slug: stringValue(formData.get("slug")),
      primaryColor: stringValue(formData.get("primaryColor")),
      seatLimit: seatLimit ? Number(seatLimit) : undefined,
      claimToken: stringValue(formData.get("claimToken")),
      logoFile: logo instanceof File && logo.size > 0 ? logo : null,
    };
  }

  try {
    return await request.json();
  } catch {
    return null;
  }
}

function getLogoMimeType(file: File): string | null {
  if (file.type && LOGO_EXTENSIONS_BY_MIME[file.type]) return file.type;

  const extension = path.extname(file.name).toLowerCase();
  return LOGO_MIME_BY_EXTENSION[extension] ?? null;
}

function validateLogo(file: File): string | null {
  if (file.size > MAX_LOGO_SIZE) {
    return "Logo file size exceeds 2 MB limit";
  }

  if (!getLogoMimeType(file)) {
    return "Logo must be an SVG, PNG, JPEG, or WebP file";
  }

  return null;
}

async function uploadTenantLogo(
  supabase: ReturnType<typeof createServiceClient>,
  tenantId: string,
  file: File,
): Promise<{ logoUrl: string; storagePath: string } | { error: string }> {
  const mimeType = getLogoMimeType(file);
  if (!mimeType) return { error: "Logo must be an SVG, PNG, JPEG, or WebP file" };

  const extension = LOGO_EXTENSIONS_BY_MIME[mimeType];
  const storagePath = `${tenantId}/logo-${Date.now()}.${extension}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await supabase.storage
    .from(LOGO_BUCKET)
    .upload(storagePath, buffer, {
      contentType: mimeType,
      upsert: false,
    });

  if (uploadError) {
    return { error: `Logo upload failed: ${uploadError.message}` };
  }

  const { data } = supabase.storage.from(LOGO_BUCKET).getPublicUrl(storagePath);
  return { logoUrl: data.publicUrl, storagePath };
}

export async function POST(request: NextRequest) {
  const body = await parsePayload(request);
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { firmName, slug, primaryColor, seatLimit, claimToken, logoFile } = body;
  if (!firmName || !slug) {
    return NextResponse.json({ error: "firmName and slug are required" }, { status: 400 });
  }
  if (!/^[a-z0-9-]+$/.test(slug)) {
    return NextResponse.json({ error: "Slug must be lowercase alphanumeric with dashes" }, { status: 400 });
  }
  if (logoFile) {
    const logoError = validateLogo(logoFile);
    if (logoError) {
      return NextResponse.json({ error: logoError }, { status: 400 });
    }
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

  let provision = claimToken
    ? await findProvisionByClaimToken(supabase, claimToken)
    : await findActiveProvisionByEmail(supabase, authUser.email);

  // Fallback: the signup route stores the provision ID in app_metadata
  // (server-only, not client-writable). Use it when the claim token was
  // lost during the email-confirmation redirect chain.
  const provisionIdFromMeta = authUser.app_metadata?.organization_provision_id as string | undefined;
  if (!provision && provisionIdFromMeta) {
    const { data } = await supabase
      .from("organization_provisions")
      .select("*")
      .eq("id", provisionIdFromMeta)
      .eq("status", "provisioned")
      .maybeSingle();
    provision = data;
  }

  if (!provision || provision.status !== "provisioned") {
    return NextResponse.json(
      { error: "This workspace can only be created by the provisioned organization contact." },
      { status: 403 },
    );
  }

  // When the provision was found via user metadata (set at signup after PoC
  // verification), the email check was already passed during signup — skip
  // it here so session-email mismatches from the redirect chain don't block.
  if (!provisionIdFromMeta && !isProvisionedPocEmail(provision, authUser.email)) {
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

  let uploadedLogoPath: string | null = null;
  let logoUrl: string | undefined;

  if (logoFile) {
    const uploadedLogo = await uploadTenantLogo(supabase, tenant.id, logoFile);
    if ("error" in uploadedLogo) {
      await supabase.from("tenants").delete().eq("id", tenant.id);
      return NextResponse.json({ error: uploadedLogo.error }, { status: 500 });
    }

    uploadedLogoPath = uploadedLogo.storagePath;
    logoUrl = uploadedLogo.logoUrl;

    const { error: logoUpdateErr } = await supabase
      .from("tenants")
      .update({ logo_url: logoUrl })
      .eq("id", tenant.id);

    if (logoUpdateErr) {
      await supabase.storage.from(LOGO_BUCKET).remove([uploadedLogoPath]);
      await supabase.from("tenants").delete().eq("id", tenant.id);
      return NextResponse.json(
        { error: logoUpdateErr.message ?? "Failed to save logo" },
        { status: 500 },
      );
    }
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
    if (uploadedLogoPath) {
      await supabase.storage.from(LOGO_BUCKET).remove([uploadedLogoPath]);
    }
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

  return NextResponse.json({ tenantId: tenant.id, slug, logoUrl }, { status: 201 });
}
