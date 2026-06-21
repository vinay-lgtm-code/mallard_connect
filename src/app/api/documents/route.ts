import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { createServiceClient } from "@/lib/supabase/server";
import { verifyToken, authError } from "@/lib/auth/verify-token";
import { uploadDocumentSchema, ALLOWED_MIME_TYPES, MAX_FILE_SIZE } from "@/schemas/document";

export async function GET(request: NextRequest) {
  const result = await verifyToken(request);
  if (!result.ok) return authError(result);
  const { auth } = result;

  const leadId = request.nextUrl.searchParams.get("leadId");
  if (!leadId) {
    return NextResponse.json({ error: "leadId is required" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("documents")
    .select("*")
    .eq("tenant_id", auth.tenantId)
    .eq("lead_id", leadId)
    .eq("is_archived", false)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}

export async function POST(request: NextRequest) {
  const result = await verifyToken(request);
  if (!result.ok) return authError(result);
  const { auth } = result;

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const leadId = formData.get("leadId") as string | null;
  const category = formData.get("category") as string | null;
  const description = (formData.get("description") as string | null) || undefined;

  if (!file) {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }

  const parsed = uploadDocumentSchema.safeParse({ leadId, category, description });
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: `File type ${file.type} is not allowed. Accepted: PDF, JPEG, PNG, WebP, DOC, DOCX` },
      { status: 400 },
    );
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: `File size exceeds 25 MB limit` },
      { status: 400 },
    );
  }

  const supabase = createServiceClient();

  const leadCheck = await supabase
    .from("leads")
    .select("id")
    .eq("id", parsed.data.leadId)
    .eq("tenant_id", auth.tenantId)
    .single();

  if (leadCheck.error || !leadCheck.data) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  const docId = randomUUID();
  const storagePath = `${auth.tenantId}/${parsed.data.leadId}/${docId}/${file.name}`;

  const buffer = Buffer.from(await file.arrayBuffer());
  const { error: uploadError } = await supabase.storage
    .from("case-documents")
    .upload(storagePath, buffer, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    return NextResponse.json({ error: `Upload failed: ${uploadError.message}` }, { status: 500 });
  }

  const { data: doc, error: insertError } = await supabase
    .from("documents")
    .insert({
      id: docId,
      tenant_id: auth.tenantId,
      lead_id: parsed.data.leadId,
      uploaded_by: auth.uid,
      file_name: file.name,
      file_size: file.size,
      mime_type: file.type,
      storage_path: storagePath,
      category: parsed.data.category,
      description: parsed.data.description ?? null,
    })
    .select()
    .single();

  if (insertError) {
    await supabase.storage.from("case-documents").remove([storagePath]);
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  await supabase.from("activities").insert({
    tenant_id: auth.tenantId,
    lead_id: parsed.data.leadId,
    performed_by: auth.uid,
    activity_type: "note",
    title: `Document uploaded: ${file.name}`,
    description: `Category: ${parsed.data.category.replace(/_/g, " ")}`,
    metadata: { documentId: docId, category: parsed.data.category },
  });

  return NextResponse.json(doc, { status: 201 });
}
