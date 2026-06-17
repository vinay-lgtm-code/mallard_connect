import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { sendOrgProvisionInviteEmail } from "@/lib/email/client";
import { isSequenceAdminEmail, normalizeEmail } from "@/lib/provisioning/domains";
import {
  createClaimToken,
  prepareOrganizationProvision,
} from "@/lib/provisioning/organization-provisions";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://sequence-ai.com";
const CLAIM_TOKEN_TTL_DAYS = 14;

type AdminAuth =
  | { ok: true; email: string }
  | { ok: false; response: NextResponse };

async function verifySequenceAdmin(request: NextRequest): Promise<AdminAuth> {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) {
    return { ok: false, response: NextResponse.json({ error: "Missing token" }, { status: 401 }) };
  }

  const supabase = createServiceClient();
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user?.email) {
    return { ok: false, response: NextResponse.json({ error: "Invalid token" }, { status: 401 }) };
  }

  if (!isSequenceAdminEmail(user.email)) {
    return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return { ok: true, email: normalizeEmail(user.email) };
}

function claimExpiry(): string {
  const expires = new Date();
  expires.setDate(expires.getDate() + CLAIM_TOKEN_TTL_DAYS);
  return expires.toISOString();
}

function claimUrl(token: string): string {
  return `${APP_URL}/signup?claim=${encodeURIComponent(token)}`;
}

export async function GET(request: NextRequest) {
  const admin = await verifySequenceAdmin(request);
  if (!admin.ok) return admin.response;

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("organization_provisions")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}

export async function POST(request: NextRequest) {
  const admin = await verifySequenceAdmin(request);
  if (!admin.ok) return admin.response;

  let body: {
    domain?: string;
    companyName?: string;
    orgPocName?: string;
    orgPocEmail?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  let prepared;
  try {
    prepared = prepareOrganizationProvision({
      domain: body.domain ?? "",
      companyName: body.companyName ?? "",
      orgPocName: body.orgPocName ?? "",
      orgPocEmail: body.orgPocEmail ?? "",
      createdByEmail: admin.email,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid provision" },
      { status: 400 },
    );
  }

  const { token, tokenHash } = createClaimToken();
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("organization_provisions")
    .insert({
      domain: prepared.domain,
      normalized_domain: prepared.normalizedDomain,
      company_name: prepared.companyName,
      org_poc_name: prepared.orgPocName,
      org_poc_email: prepared.orgPocEmail,
      normalized_org_poc_email: prepared.normalizedOrgPocEmail,
      created_by_email: prepared.createdByEmail,
      updated_by_email: prepared.createdByEmail,
      claim_token_hash: tokenHash,
      claim_token_expires_at: claimExpiry(),
      invited_at: new Date().toISOString(),
    })
    .select("*")
    .single();

  if (error) {
    const status = error.code === "23505" ? 409 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }

  try {
    await sendOrgProvisionInviteEmail({
      to: prepared.orgPocEmail,
      fullName: prepared.orgPocName,
      companyName: prepared.companyName,
      claimUrl: claimUrl(token),
    });
  } catch (error) {
    console.error("[organization-provisions] invite email failed:", error);
  }

  return NextResponse.json(data, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const admin = await verifySequenceAdmin(request);
  if (!admin.ok) return admin.response;

  let body: { id?: string; action?: "resend" | "disable" };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.id || !body.action) {
    return NextResponse.json({ error: "id and action are required" }, { status: 400 });
  }

  const supabase = createServiceClient();

  if (body.action === "disable") {
    const { data, error } = await supabase
      .from("organization_provisions")
      .update({
        status: "disabled",
        disabled_at: new Date().toISOString(),
        updated_by_email: admin.email,
      })
      .eq("id", body.id)
      .neq("status", "claimed")
      .select("*")
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ error: "Provision not found or already claimed" }, { status: 404 });
    return NextResponse.json(data);
  }

  const { data: provision, error: fetchError } = await supabase
    .from("organization_provisions")
    .select("*")
    .eq("id", body.id)
    .eq("status", "provisioned")
    .maybeSingle();

  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });
  if (!provision) return NextResponse.json({ error: "Provision not found or not resendable" }, { status: 404 });

  const { token, tokenHash } = createClaimToken();
  const { data, error } = await supabase
    .from("organization_provisions")
    .update({
      claim_token_hash: tokenHash,
      claim_token_expires_at: claimExpiry(),
      invited_at: new Date().toISOString(),
      updated_by_email: admin.email,
    })
    .eq("id", body.id)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  try {
    await sendOrgProvisionInviteEmail({
      to: provision.org_poc_email,
      fullName: provision.org_poc_name,
      companyName: provision.company_name,
      claimUrl: claimUrl(token),
    });
  } catch (error) {
    console.error("[organization-provisions] resend email failed:", error);
  }

  return NextResponse.json(data);
}
