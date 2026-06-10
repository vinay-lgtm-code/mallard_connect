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

function mapToDbRow(mappedData: Record<string, string | undefined>) {
  const result: Record<string, string | number | null> = {};

  if (mappedData.firstName && !mappedData.lastName) {
    const parts = mappedData.firstName.trim().split(/\s+/);
    result.first_name = parts[0];
    result.last_name = parts.slice(1).join(" ") || null;
  } else {
    if (mappedData.firstName) result.first_name = mappedData.firstName;
    if (mappedData.lastName) result.last_name = mappedData.lastName;
  }

  if (mappedData.phone) result.phone = mappedData.phone;
  if (mappedData.email) result.email = mappedData.email;
  if (mappedData.source) result.source = mappedData.source;
  if (mappedData.mortgageType) result.mortgage_type = mappedData.mortgageType;
  if (mappedData.readiness) result.readiness = mappedData.readiness;
  if (mappedData.notes) result.follow_up_notes = mappedData.notes;
  if (mappedData.referredBy) result.referred_by = mappedData.referredBy;
  if (mappedData.assignedTo) result.assigned_to = mappedData.assignedTo;

  return result;
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

    const { rows: parsed, columns, columnMapping } = await parseImportFile(buffer, mimeType);

    const { data: existing } = await supabase
      .from("leads")
      .select("id, phone, email, updated_at")
      .eq("tenant_id", caller.tenantId);

    const dedupResult = findDuplicates(parsed, existing ?? []);

    return NextResponse.json({
      columns,
      columnMapping,
      stats: {
        new: dedupResult.new.length,
        skip: dedupResult.duplicateSkip.length,
      },
      duplicates: dedupResult.duplicateUpdate.map((r) => ({
        id: r.matchedLeadId,
        name: r.mappedData.firstName || r.mappedData.name || "",
        phone: r.mappedData.phone || "",
      })),
      toCreate: dedupResult.new,
      toUpdate: dedupResult.duplicateUpdate,
    });
  }

  const body = await request.json();
  if (body.action !== "execute") {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  const { toCreate, toUpdate }: { toCreate: ImportRow[]; toUpdate: ImportRow[] } = body;
  let created = 0;
  let updated = 0;

  for (const row of toCreate ?? []) {
    const dbRow = mapToDbRow(row.mappedData);
    const { error } = await supabase.from("leads").insert({
      ...dbRow,
      tenant_id: caller.tenantId,
      status: "active",
    });
    if (!error) created++;
  }

  for (const row of toUpdate ?? []) {
    if (!row.matchedLeadId) continue;
    const dbRow = mapToDbRow(row.mappedData);
    const { error } = await supabase.from("leads").update(dbRow)
      .eq("id", row.matchedLeadId)
      .eq("tenant_id", caller.tenantId);
    if (!error) updated++;
  }

  await supabase.from("import_records").insert({
    tenant_id: caller.tenantId,
    uploaded_by: caller.uid,
    file_name: body.fileName ?? "import",
    column_mapping: body.columnMapping ?? {},
    stats: {
      total: (toCreate ?? []).length + (toUpdate ?? []).length,
      imported: created,
      updated,
      skipped: (toCreate ?? []).length - created,
      failed: 0,
    },
    status: "completed",
  });

  return NextResponse.json({ created, updated });
}
