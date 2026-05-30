import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { parseImportFile } from "@/lib/import/parser";
import { findDuplicates } from "@/lib/import/dedup";
import type { ImportRow } from "@/lib/import/dedup";

async function requireAdminOrManager(request: NextRequest) {
  const supabase = createServiceClient();
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return null;

  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) return null;

  const { data: profile } = await supabase
    .from("users")
    .select("role, tenant_id")
    .eq("id", user.id)
    .single();

  if (!profile) return null;
  const role = profile.role as string;
  const tenantId = profile.tenant_id as string;
  if (role !== "admin" && role !== "manager") return null;

  return { uid: user.id, role, tenantId };
}

export async function POST(request: NextRequest) {
  const caller = await requireAdminOrManager(request);
  if (!caller) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const contentType = request.headers.get("content-type") ?? "";
  const supabase = createServiceClient();

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const mimeType = file.type;

    const parsed = await parseImportFile(buffer, mimeType);

    const { data: existing } = await supabase
      .from("leads")
      .select("id, phone, email, updated_at")
      .eq("tenant_id", caller.tenantId);

    const dedupResult = findDuplicates(parsed, existing ?? []);
    return NextResponse.json(dedupResult);
  }

  const body = await request.json();
  if (body.action !== "execute") {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  const { toCreate, toUpdate }: { toCreate: ImportRow[]; toUpdate: ImportRow[] } = body;

  for (const row of toCreate ?? []) {
    await supabase.from("leads").insert({
      ...row.mappedData,
      tenant_id: caller.tenantId,
      status: "active",
    });
  }

  for (const row of toUpdate ?? []) {
    if (!row.matchedLeadId) continue;
    await supabase.from("leads").update({
      ...row.mappedData,
    }).eq("id", row.matchedLeadId).eq("tenant_id", caller.tenantId);
  }

  await supabase.from("import_records").insert({
    tenant_id: caller.tenantId,
    uploaded_by: caller.uid,
    file_name: "import",
    column_mapping: {},
    stats: {
      total: (toCreate ?? []).length + (toUpdate ?? []).length,
      imported: (toCreate ?? []).length,
      skipped: 0,
      failed: 0,
    },
    status: "completed",
  });

  return NextResponse.json({
    created: (toCreate ?? []).length,
    updated: (toUpdate ?? []).length,
  });
}
