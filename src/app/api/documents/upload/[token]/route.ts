import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { createServiceClient } from "@/lib/supabase/server";
import { hashInviteToken } from "@/lib/invitations";
import { ALLOWED_MIME_TYPES, MAX_FILE_SIZE } from "@/schemas/document";

async function resolveRequest(tokenParam: string) {
  const tokenHash = hashInviteToken(tokenParam);
  const supabase = createServiceClient();
  const { data: req } = await supabase
    .from("document_requests")
    .select("*, leads(id, first_name, last_name), tenants(name)")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (!req) return null;
  if (req.status !== "pending" || new Date(req.expires_at).getTime() < Date.now()) return null;
  return req;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const req = await resolveRequest(token);
  if (!req) {
    return NextResponse.json({ error: "Invalid or expired link" }, { status: 410 });
  }

  const supabase = createServiceClient();
  const { data: existingDocs } = await supabase
    .from("documents")
    .select("id, category, file_name, file_size, created_at")
    .eq("lead_id", req.lead_id)
    .eq("tenant_id", req.tenant_id)
    .eq("is_archived", false)
    .order("created_at", { ascending: false });

  const lead = Array.isArray(req.leads) ? req.leads[0] : req.leads;
  const tenant = Array.isArray(req.tenants) ? req.tenants[0] : req.tenants;

  return NextResponse.json({
    leadName: lead ? `${lead.first_name} ${lead.last_name}` : "Client",
    firmName: tenant?.name ?? "Your adviser",
    requestedCategories: req.requested_categories,
    message: req.message,
    uploadedDocuments: existingDocs ?? [],
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const req = await resolveRequest(token);
  if (!req) {
    return NextResponse.json({ error: "Invalid or expired link" }, { status: 410 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const category = formData.get("category") as string | null;

  if (!file || !category) {
    return NextResponse.json({ error: "file and category are required" }, { status: 400 });
  }

  if (!(req.requested_categories as string[]).includes(category)) {
    return NextResponse.json({ error: "Category not in this request" }, { status: 400 });
  }

  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return NextResponse.json({ error: "File type not allowed" }, { status: 400 });
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "File too large (max 25 MB)" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const docId = randomUUID();
  const safeName = path.basename(file.name).replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 200) || "file";
  const storagePath = `${req.tenant_id}/${req.lead_id}/${docId}/${safeName}`;

  const buffer = Buffer.from(await file.arrayBuffer());
  const { error: uploadError } = await supabase.storage
    .from("case-documents")
    .upload(storagePath, buffer, { contentType: file.type, upsert: false });

  if (uploadError) {
    return NextResponse.json({ error: `Upload failed: ${uploadError.message}` }, { status: 500 });
  }

  const { data: doc, error: insertError } = await supabase
    .from("documents")
    .insert({
      id: docId,
      tenant_id: req.tenant_id,
      lead_id: req.lead_id,
      uploaded_by: req.requested_by,
      file_name: file.name,
      file_size: file.size,
      mime_type: file.type,
      storage_path: storagePath,
      category,
      description: `Uploaded by client via document request`,
    })
    .select()
    .single();

  if (insertError) {
    await supabase.storage.from("case-documents").remove([storagePath]);
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  const lead = Array.isArray(req.leads) ? req.leads[0] : req.leads;
  const clientName = lead ? `${lead.first_name} ${lead.last_name}` : "Client";

  await supabase.from("activities").insert({
    tenant_id: req.tenant_id,
    lead_id: req.lead_id,
    performed_by: req.requested_by,
    activity_type: "note",
    title: `${clientName} uploaded: ${file.name}`,
    description: `Category: ${category.replace(/_/g, " ")} (via upload link)`,
    metadata: { documentId: docId, category, uploadedByClient: true },
  });

  return NextResponse.json(doc, { status: 201 });
}
