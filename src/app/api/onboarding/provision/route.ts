import { NextRequest, NextResponse } from "next/server";
import path from "node:path";
import { createServiceClient } from "@/lib/supabase/server";
import { seedTenantCadencesAndTemplates } from "@/lib/cadences/seed-tenant";
import {
  findActiveProvisionByEmail,
  findProvisionByClaimToken,
  isProvisionedPocEmail,
} from "@/lib/provisioning/organization-provisions";
import { DEFAULT_PIPELINE_STAGES } from "@/lib/pipeline-stages";

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
    .insert(DEFAULT_PIPELINE_STAGES.map((s) => ({
      name: s.name,
      slug: s.slug,
      position: s.position,
      color: s.color,
      is_terminal: s.isTerminal,
      tenant_id: tenant.id,
    })));

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
