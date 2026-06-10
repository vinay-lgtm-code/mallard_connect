import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { parseImportFile, normalizeMortgageType } from "@/lib/import/parser";
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function transformMappedData(mappedData: Record<string, any>) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: Record<string, any> = { ...mappedData };

    // (a) Normalize mortgage type
    if (data.mortgageType) {
      data.mortgageType = normalizeMortgageType(data.mortgageType);
    }

    // (b) Resolve advisor name to user ID
    if (data.assignedTo && !/^[0-9a-f]{8}-/.test(data.assignedTo)) {
      const safeName = String(data.assignedTo).replace(/[%_\\]/g, "\\$&");
      const { data: matchedUser } = await supabase
        .from("users")
        .select("id")
        .eq("tenant_id", caller!.tenantId)
        .ilike("full_name", safeName)
        .single();
      data.assignedTo = matchedUser?.id ?? null;
    }

    // (c) Split "name" (Client column) into firstName / lastName
    if (data.name) {
      const trimmed = data.name.trim();
      const lastSpace = trimmed.lastIndexOf(" ");
      if (lastSpace === -1) {
        data.firstName = "";
        data.lastName = trimmed;
      } else {
        data.firstName = trimmed.slice(0, lastSpace);
        data.lastName = trimmed.slice(lastSpace + 1);
      }
      delete data.name;
    }

    // (d) Map notes to follow_up_notes
    if (data.notes !== undefined) {
      data.follow_up_notes = data.notes;
      delete data.notes;
    }

    // (e) Parse factFindDate (DD/MM/YYYY) into ISO string
    if (data.factFindDate !== undefined) {
      let parsed: Date | null = null;
      const ddmmyyyy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
      const match = String(data.factFindDate).match(ddmmyyyy);
      if (match) {
        const [, dd, mm, yyyy] = match;
        parsed = new Date(`${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`);
      } else {
        const attempt = new Date(data.factFindDate);
        if (!isNaN(attempt.getTime())) parsed = attempt;
      }
      data.fact_find_date = parsed ? parsed.toISOString() : null;
      delete data.factFindDate;
    }

    return data;
  }

  for (const row of toCreate ?? []) {
    const transformed = await transformMappedData(row.mappedData);
    await supabase.from("leads").insert({
      ...transformed,
      tenant_id: caller.tenantId,
      status: "active",
    });
  }

  for (const row of toUpdate ?? []) {
    if (!row.matchedLeadId) continue;
    const transformed = await transformMappedData(row.mappedData);
    await supabase.from("leads").update({
      ...transformed,
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
