import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { verifyToken, authError } from "@/lib/auth/verify-token";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const result = await verifyToken(request);
  if (!result.ok) return authError(result);
  const { auth } = result;
  const { id } = await params;

  const supabase = createServiceClient();
  const { data: doc, error } = await supabase
    .from("documents")
    .select("*")
    .eq("id", id)
    .eq("tenant_id", auth.tenantId)
    .single();

  if (error || !doc) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  const { data: signedUrl } = await supabase.storage
    .from("case-documents")
    .createSignedUrl(doc.storage_path, 60);

  if (!signedUrl?.signedUrl) {
    return NextResponse.json({ error: "Failed to generate download URL" }, { status: 500 });
  }

  return NextResponse.json({ url: signedUrl.signedUrl });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const result = await verifyToken(request, { requireRole: ["admin", "manager"] });
  if (!result.ok) return authError(result);
  const { auth } = result;
  const { id } = await params;

  const supabase = createServiceClient();
  const { data: doc, error } = await supabase
    .from("documents")
    .select("*")
    .eq("id", id)
    .eq("tenant_id", auth.tenantId)
    .single();

  if (error || !doc) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  await supabase.storage.from("case-documents").remove([doc.storage_path]);

  await supabase
    .from("documents")
    .update({ is_archived: true })
    .eq("id", id)
    .eq("tenant_id", auth.tenantId);

  return NextResponse.json({ ok: true });
}
