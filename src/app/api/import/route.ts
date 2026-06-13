import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { parseImportFile, normalizeMortgageType } from "@/lib/import/parser";
import { appToRow } from "@/lib/supabase/mappers";
import { findDuplicates } from "@/lib/import/dedup";
import type { ImportRow } from "@/lib/import/dedup";
import { verifyToken, authError } from "@/lib/auth/verify-token";
import { sendImportSummaryEmail } from "@/lib/email/client";

export async function POST(request: NextRequest) {
  const result = await verifyToken(request, { requireRole: ["admin", "manager"] });
  if (!result.ok) return authError(result);
  const caller = result.auth;

  const contentType = request.headers.get("content-type") ?? "";
  const supabase = createServiceClient();

  if (contentType.includes("multipart/form-data")) {
    try {
      const formData = await request.formData();
      const file = formData.get("file");
      if (!file || typeof file === "string") {
        return NextResponse.json({ error: "No file provided" }, { status: 400 });
      }

      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const mimeType = file.type;

      const { rows: parsed, columns, columnMapping } = await parseImportFile(buffer, mimeType);

      const { data: existingRaw } = await supabase
        .from("leads")
        .select("id, phone, email, updated_at")
        .eq("tenant_id", caller.tenantId);

      const existing = (existingRaw ?? []).map(row => ({
        id: row.id,
        phone: row.phone,
        email: row.email,
        updatedAt: row.updated_at,
      }));

      const dedupResult = findDuplicates(parsed, existing);
      return NextResponse.json({
        columns,
        columnMapping,
        stats: {
          new: dedupResult.new.length,
          skip: dedupResult.duplicateSkip.length,
        },
        toCreate: dedupResult.new,
        toUpdate: dedupResult.duplicateUpdate,
        duplicates: dedupResult.duplicateUpdate.map(row => ({
          id: row.matchedLeadId,
          name: row.mappedData.name || row.mappedData.phone || "Unknown",
          phone: row.mappedData.phone || "",
        })),
      });
    } catch (err) {
      console.error("Import parse error:", err);
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Failed to parse file" },
        { status: 400 }
      );
    }
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

    if (data.mortgageType) {
      data.mortgageType = normalizeMortgageType(data.mortgageType);
    }

    if (data.assignedTo && !/^[0-9a-f]{8}-/.test(data.assignedTo)) {
      const safeName = String(data.assignedTo).replace(/[%_\\]/g, "\\$&");
      const { data: matchedUser } = await supabase
        .from("users")
        .select("id")
        .eq("tenant_id", caller.tenantId)
        .ilike("full_name", safeName)
        .single();
      data.assignedTo = matchedUser?.id ?? null;
    }

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

    if (data.notes !== undefined) {
      data.follow_up_notes = data.notes;
      delete data.notes;
    }

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

    return appToRow(data);
  }

  let created = 0;
  let updated = 0;
  let failed = 0;

  for (const row of toCreate ?? []) {
    try {
      const transformed = await transformMappedData(row.mappedData);
      const { error } = await supabase.from("leads").insert({
        ...transformed,
        tenant_id: caller.tenantId,
        status: "active",
      });
      if (error) { failed++; } else { created++; }
    } catch {
      failed++;
    }
  }

  for (const row of toUpdate ?? []) {
    if (!row.matchedLeadId) continue;
    try {
      const transformed = await transformMappedData(row.mappedData);
      const { error } = await supabase.from("leads").update({
        ...transformed,
      }).eq("id", row.matchedLeadId).eq("tenant_id", caller.tenantId);
      if (error) { failed++; } else { updated++; }
    } catch {
      failed++;
    }
  }

  const total = (toCreate ?? []).length + (toUpdate ?? []).length;

  await supabase.from("import_records").insert({
    tenant_id: caller.tenantId,
    uploaded_by: caller.uid,
    file_name: "import",
    column_mapping: {},
    stats: {
      total,
      imported: created + updated,
      skipped: 0,
      failed,
    },
    status: "completed",
  });

  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://sequence-ai.com";
    await sendImportSummaryEmail({
      to: caller.email,
      uploaderName: caller.fullName,
      created,
      updated,
      failed,
      total,
      importUrl: `${appUrl}/leads`,
    });
  } catch { /* email failure is non-fatal */ }

  return NextResponse.json({ created, updated, failed });
}
