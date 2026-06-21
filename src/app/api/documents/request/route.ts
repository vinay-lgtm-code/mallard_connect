import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { verifyToken, authError } from "@/lib/auth/verify-token";
import { createInviteToken, inviteExpiry } from "@/lib/invitations";
import { sendDocumentRequestEmail } from "@/lib/email/client";
import { DOCUMENT_CATEGORIES, CATEGORY_LABELS } from "@/schemas/document";

export async function POST(request: NextRequest) {
  const result = await verifyToken(request);
  if (!result.ok) return authError(result);
  const { auth } = result;

  let body: {
    leadId?: string;
    leadEmail?: string;
    categories?: string[];
    message?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { leadId, leadEmail, categories, message } = body;
  if (!leadId || !leadEmail || !categories?.length) {
    return NextResponse.json(
      { error: "leadId, leadEmail, and categories are required" },
      { status: 400 },
    );
  }

  const validCategories = categories.filter((c) =>
    (DOCUMENT_CATEGORIES as readonly string[]).includes(c),
  );
  if (!validCategories.length) {
    return NextResponse.json({ error: "No valid categories" }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { data: lead } = await supabase
    .from("leads")
    .select("id, first_name, last_name")
    .eq("id", leadId)
    .eq("tenant_id", auth.tenantId)
    .single();

  if (!lead) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  const { data: tenant } = await supabase
    .from("tenants")
    .select("name")
    .eq("id", auth.tenantId)
    .single();

  const { token, tokenHash } = createInviteToken();

  const { data: docRequest, error: insertError } = await supabase
    .from("document_requests")
    .insert({
      tenant_id: auth.tenantId,
      lead_id: leadId,
      requested_by: auth.uid,
      token_hash: tokenHash,
      lead_email: leadEmail.trim(),
      requested_categories: validCategories,
      message: message?.trim() || null,
      expires_at: inviteExpiry(),
    })
    .select("id")
    .single();

  if (insertError || !docRequest) {
    return NextResponse.json(
      { error: insertError?.message ?? "Failed to create request" },
      { status: 500 },
    );
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.sequence-ai.com";
  const uploadUrl = `${appUrl}/upload/${encodeURIComponent(token)}`;

  const categoryLabels = validCategories.map(
    (c) => CATEGORY_LABELS[c as keyof typeof CATEGORY_LABELS] ?? c,
  );

  try {
    await sendDocumentRequestEmail({
      to: leadEmail.trim(),
      leadFirstName: lead.first_name,
      adviserName: auth.fullName ?? "Your adviser",
      firmName: tenant?.name ?? "your mortgage adviser",
      categories: categoryLabels,
      message: message?.trim(),
      uploadUrl,
    });
  } catch {
    // email failure is non-fatal
  }

  await supabase.from("activities").insert({
    tenant_id: auth.tenantId,
    lead_id: leadId,
    performed_by: auth.uid,
    activity_type: "email",
    title: `Document request sent to ${leadEmail.trim()}`,
    description: `Requested ${validCategories.length} document(s): ${categoryLabels.join(", ")}`,
    metadata: { documentRequestId: docRequest.id, categories: validCategories },
  });

  return NextResponse.json({ id: docRequest.id }, { status: 201 });
}
