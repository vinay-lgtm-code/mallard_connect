import { NextRequest, NextResponse } from "next/server";
import { createHash, randomUUID } from "node:crypto";
import { createServiceClient } from "@/lib/supabase/server";
import { parseImportFile, normalizeMortgageType } from "@/lib/import/parser";
import { appToRow } from "@/lib/supabase/mappers";
import { findDuplicates } from "@/lib/import/dedup";
import type { ImportRow } from "@/lib/import/dedup";
import { verifyToken, authError } from "@/lib/auth/verify-token";
import { sendImportSummaryEmail } from "@/lib/email/client";

type PipelineStageRow = {
  id: string;
  slug: string;
  name: string;
  position: number;
  is_terminal: boolean;
};

type LeadSourceRow = {
  id: string;
  slug: string;
  name: string;
};

type UserRow = {
  id: string;
  email: string | null;
  full_name: string | null;
};

const DEFAULT_STAGE_SLUG = "new_enquiry";

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "other";
}

function normalizeSourceSlug(value: string | undefined): string {
  const raw = (value ?? "").toLowerCase().trim();
  const compact = raw.replace(/\s+/g, "");
  const synonyms: Record<string, string> = {
    fb: "facebook",
    facebook: "facebook",
    "social media": "social",
    socialmedia: "social",
    tictok: "tiktok",
    tiktok: "tiktok",
    "tik tok": "tiktok",
    bni: "bni",
    google: "google",
    referral: "referral",
    website: "website",
    phone: "phone",
  };
  return synonyms[raw] ?? synonyms[compact] ?? slugify(raw || "other");
}

function parseNumber(value: unknown): number | undefined {
  if (value == null || value === "") return undefined;
  const parsed = Number(String(value).replace(/[£$,\s%]/g, ""));
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseFlexibleDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;

  const text = String(value).trim();
  if (!text) return null;

  const slash = /^(\d{1,2})[/-](\d{1,2})[/-](\d{2}|\d{4})$/.exec(text);
  if (slash) {
    const [, a, b, y] = slash;
    const year = y.length === 2 ? 2000 + Number(y) : Number(y);
    const first = Number(a);
    const second = Number(b);
    const day = first > 12 ? first : second > 12 ? second : first;
    const month = first > 12 ? second : second > 12 ? first : second;
    const parsed = new Date(Date.UTC(year, month - 1, day));
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function dateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function normalizeReadiness(value: string | undefined): string | undefined {
  const raw = (value ?? "").toLowerCase().trim();
  if (!raw) return undefined;
  if (["ready-now", "ready now", "now", "asap"].includes(raw)) return "ready-now";
  if (["1-3-months", "1-3 months", "1 to 3 months"].includes(raw)) return "1-3-months";
  if (["3-6-months", "3-6 months", "3 to 6 months"].includes(raw)) return "3-6-months";
  if (["6-12-months", "6-12 months", "6 to 12 months"].includes(raw)) return "6-12-months";
  if (["exploring", "researching"].includes(raw)) return "exploring";
  return undefined;
}

function normalizeLeadStatus(value: string | undefined): "active" | "on-hold" | "lost" | "converted" | undefined {
  const raw = (value ?? "").toLowerCase().trim();
  if (!raw) return undefined;
  if (["active", "open", "in progress"].includes(raw)) return "active";
  if (["on-hold", "on hold", "hold", "paused"].includes(raw)) return "on-hold";
  if (["lost", "closed lost", "declined"].includes(raw)) return "lost";
  if (["converted", "won", "closed won", "complete", "completed"].includes(raw)) return "converted";
  return undefined;
}

function inferStageSlug(mappedData: Record<string, unknown>): string {
  const explicit = typeof mappedData.currentStage === "string" ? mappedData.currentStage : "";
  const explicitSlug = slugify(explicit.replace(/\s+stage$/i, ""));
  const stageSynonyms: Record<string, string> = {
    "new-enquiry": "new_enquiry",
    "new": "new_enquiry",
    "initial-contact": "initial_contact",
    "contacted": "initial_contact",
    "not-ready-yet": "not_ready_yet",
    "not-ready": "not_ready_yet",
    "nurturing": "nurturing",
    "ready-to-proceed": "ready_to_proceed",
    "ready": "ready_to_proceed",
    "deal-done": "referred_to_mab",
    "referred-to-mab": "referred_to_mab",
    "converted": "referred_to_mab",
  };
  if (explicitSlug && stageSynonyms[explicitSlug]) return stageSynonyms[explicitSlug];

  const notes = String(mappedData.notes ?? "").toLowerCase();
  if (/\b(complet(?:e|ed|ion)|deal done|offer issued|offer accepted)\b/.test(notes)) {
    return "referred_to_mab";
  }
  if (/\b(dip|decision in principle|agreement in principle|aip)\b/.test(notes)) {
    return "ready_to_proceed";
  }
  if (/\b(not ready|future|later|hold)\b/.test(notes)) return "not_ready_yet";
  if (/\b(nurtur|checking in|follow up)\b/.test(notes)) return "nurturing";
  if (mappedData.factFindDate) return "initial_contact";
  return DEFAULT_STAGE_SLUG;
}

function inferredDealValue(mortgageType: string | undefined): number {
  switch (mortgageType) {
    case "buy-to-let": return 1500;
    case "remortgage": return 1100;
    case "first-time-buyer": return 1250;
    case "self-employed": return 1400;
    default: return 1000;
  }
}

function inferredConfidence(stageSlug: string): number {
  switch (stageSlug) {
    case "referred_to_mab": return 100;
    case "ready_to_proceed": return 75;
    case "nurturing": return 45;
    case "initial_contact": return 35;
    case "not_ready_yet": return 20;
    default: return 20;
  }
}

function syntheticPhoneFor(mappedData: Record<string, unknown>): string {
  const seed = [
    mappedData.name,
    mappedData.firstName,
    mappedData.lastName,
    mappedData.createdAt,
    mappedData.source,
  ].map((value) => String(value ?? "").trim()).join("|");
  const digest = createHash("sha1").update(seed || randomUUID()).digest("hex").slice(0, 10);
  return `import-${digest}`;
}

function rowLabel(row: ImportRow, index: number): string {
  return row.mappedData.name || row.mappedData.email || row.mappedData.phone || `row ${index + 1}`;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "object" && error && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message) return message;
  }
  return "Unknown import error";
}

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

  const { toCreate, toUpdate, fileName }: { toCreate: ImportRow[]; toUpdate: ImportRow[]; fileName?: string } = body;

  const [
    { data: stageRows, error: stageError },
    { data: sourceRows, error: sourceError },
    { data: userRows, error: userError },
  ] = await Promise.all([
    supabase
      .from("pipeline_stages")
      .select("id, slug, name, position, is_terminal")
      .eq("tenant_id", caller.tenantId)
      .order("position", { ascending: true }),
    supabase
      .from("lead_sources")
      .select("id, slug, name")
      .eq("tenant_id", caller.tenantId),
    supabase
      .from("users")
      .select("id, email, full_name")
      .eq("tenant_id", caller.tenantId),
  ]);

  const setupError = stageError ?? sourceError ?? userError;
  if (setupError) {
    return NextResponse.json({
      created: 0,
      updated: 0,
      failed: (toCreate ?? []).length + (toUpdate ?? []).length,
      error: "Failed to load import setup data",
      errors: [setupError.message],
    }, { status: 500 });
  }

  const stages = (stageRows ?? []) as PipelineStageRow[];
  const sources = new Map<string, LeadSourceRow>(
    ((sourceRows ?? []) as LeadSourceRow[]).map((source) => [source.slug, source])
  );
  const users = (userRows ?? []) as UserRow[];
  const stageBySlug = new Map(stages.map((stage) => [stage.slug, stage]));
  const firstStage = stages[0];

  async function resolveSourceId(rawSource: string | undefined): Promise<string | null> {
    const slug = normalizeSourceSlug(rawSource);
    const existing = sources.get(slug);
    if (existing) return existing.id;

    const name = rawSource?.trim() || "Other";
    const { data: inserted, error } = await supabase
      .from("lead_sources")
      .upsert(
        { tenant_id: caller.tenantId, name, slug, is_active: true },
        { onConflict: "tenant_id,slug" }
      )
      .select("id, slug, name")
      .single();

    if (error || !inserted) return sources.get("other")?.id ?? null;
    const source = inserted as LeadSourceRow;
    sources.set(source.slug, source);
    return source.id;
  }

  function resolveAssignee(rawAssignee: string | undefined): string | null {
    const value = rawAssignee?.trim();
    if (!value) return null;
    if (/^[0-9a-f]{8}-/i.test(value)) return value;

    const normalized = value.toLowerCase();
    const matched = users.find((user) =>
      user.email?.toLowerCase() === normalized ||
      user.full_name?.toLowerCase() === normalized ||
      user.full_name?.toLowerCase().split(/\s+/).includes(normalized)
    );
    return matched?.id ?? null;
  }

  async function transformMappedData(mappedData: Record<string, string | undefined>, mode: "create" | "update") {
    const data: Record<string, unknown> = { ...mappedData };

    const createdAt = parseFlexibleDate(data.createdAt);
    const factFindDate = parseFlexibleDate(data.factFindDate);
    const explicitEstimatedCloseDate = parseFlexibleDate(data.estimatedCloseDate);
    const stageSlug = inferStageSlug(data);
    const stage = stageBySlug.get(stageSlug) ?? stageBySlug.get(DEFAULT_STAGE_SLUG) ?? firstStage;
    const mortgageType = typeof data.mortgageType === "string" && data.mortgageType.trim()
      ? normalizeMortgageType(data.mortgageType)
      : undefined;

    if (mortgageType) {
      data.mortgageType = mortgageType;
    } else {
      delete data.mortgageType;
    }

    data.sourceId = await resolveSourceId(typeof data.source === "string" ? data.source : undefined);
    delete data.source;

    const rawAdvisor =
      typeof data.advisor === "string"
        ? data.advisor
        : typeof data.assignedTo === "string"
          ? data.assignedTo
          : undefined;
    data.assignedTo = resolveAssignee(rawAdvisor);
    delete data.advisor;

    if (data.name) {
      const trimmed = String(data.name).trim();
      const lastSpace = trimmed.lastIndexOf(" ");
      if (lastSpace === -1) {
        data.firstName = data.firstName || "Imported";
        data.lastName = trimmed;
      } else {
        data.firstName = data.firstName || trimmed.slice(0, lastSpace);
        data.lastName = data.lastName || trimmed.slice(lastSpace + 1);
      }
      delete data.name;
    }

    data.firstName = String(data.firstName ?? "Imported").trim() || "Imported";
    data.lastName = String(data.lastName ?? "Lead").trim() || "Lead";

    if (mode === "create") {
      const phone = String(data.phone ?? "").trim();
      data.phone = phone || syntheticPhoneFor(mappedData);
    } else if (!data.phone) {
      delete data.phone;
    }
    if (!data.email) delete data.email;

    if (data.notes !== undefined) {
      data.follow_up_notes = data.notes;
      delete data.notes;
    }

    if (factFindDate) {
      data.factFindDate = dateOnly(factFindDate);
    } else {
      delete data.factFindDate;
    }

    if (createdAt) {
      data.createdAt = createdAt.toISOString();
    } else {
      delete data.createdAt;
    }

    data.currentStageId = stage?.id ?? null;
    data.currentStageEnteredAt = (createdAt ?? new Date()).toISOString();
    delete data.currentStage;

    const normalizedReadiness = normalizeReadiness(typeof data.readiness === "string" ? data.readiness : undefined);
    if (normalizedReadiness) {
      data.readiness = normalizedReadiness;
    } else if (stageSlug === "ready_to_proceed") {
      data.readiness = "ready-now";
    } else if (stageSlug === "initial_contact") {
      data.readiness = "1-3-months";
    } else if (stageSlug === "nurturing") {
      data.readiness = "3-6-months";
    } else if (stageSlug === "not_ready_yet") {
      data.readiness = "6-12-months";
    } else {
      delete data.readiness;
    }

    const status = normalizeLeadStatus(typeof data.status === "string" ? data.status : undefined);
    data.status = status ?? (stage?.is_terminal ? "converted" : "active");

    for (const key of ["propertyValue", "depositAmount", "loanAmount", "dealValue", "confidence"]) {
      const parsed = parseNumber(data[key]);
      if (parsed === undefined) delete data[key];
      else data[key] = key === "confidence" ? Math.min(Math.max(Math.round(parsed), 0), 100) : parsed;
    }

    if (data.dealValue === undefined && mortgageType) {
      data.dealValue = inferredDealValue(mortgageType);
    }
    if (data.confidence === undefined) {
      data.confidence = inferredConfidence(stageSlug);
    }

    const forecastBaseDate = factFindDate ?? createdAt ?? new Date();
    const inferredEstimatedClose = stage?.is_terminal
      ? null
      : addDays(forecastBaseDate, stageSlug === "ready_to_proceed" ? 35 : 75);
    if (explicitEstimatedCloseDate) {
      data.estimatedCloseDate = dateOnly(explicitEstimatedCloseDate);
    } else if (inferredEstimatedClose) {
      data.estimatedCloseDate = dateOnly(inferredEstimatedClose);
    } else {
      delete data.estimatedCloseDate;
    }

    if (data.status === "converted") {
      data.convertedAt = (explicitEstimatedCloseDate ?? createdAt ?? new Date()).toISOString();
    } else if (data.status === "lost") {
      data.lostAt = (createdAt ?? new Date()).toISOString();
    }

    return appToRow(data);
  }

  let created = 0;
  let updated = 0;
  let failed = 0;
  const errors: string[] = [];
  const total = (toCreate ?? []).length + (toUpdate ?? []).length;

  const { data: importRecord, error: importRecordError } = await supabase.from("import_records").insert({
    tenant_id: caller.tenantId,
    uploaded_by: caller.uid,
    file_name: fileName ?? "import",
    column_mapping: {},
    stats: {
      total,
      imported: 0,
      skipped: 0,
      failed: 0,
    },
    status: "processing",
  }).select("id").single();

  const importId = importRecord?.id as string | undefined;
  if (importRecordError) {
    errors.push(`Import record: ${importRecordError.message}`);
  }

  for (const [index, row] of (toCreate ?? []).entries()) {
    try {
      const transformed = await transformMappedData(row.mappedData, "create");
      const { data: insertedLead, error } = await supabase.from("leads").insert({
        ...transformed,
        tenant_id: caller.tenantId,
        import_id: importId ?? null,
      }).select("id, current_stage_id, current_stage_entered_at").single();
      if (error) {
        failed++;
        errors.push(`${rowLabel(row, index)}: ${error.message}`);
      } else {
        created++;
        const lead = insertedLead as { id: string; current_stage_id: string | null; current_stage_entered_at: string | null } | null;
        if (lead?.id) {
          const stage = stages.find((item) => item.id === lead.current_stage_id);
          await supabase.from("lead_stage_history").insert({
            tenant_id: caller.tenantId,
            lead_id: lead.id,
            stage_id: lead.current_stage_id,
            stage_slug: stage?.slug ?? null,
            entered_at: lead.current_stage_entered_at ?? new Date().toISOString(),
          });
          await supabase.from("activities").insert({
            tenant_id: caller.tenantId,
            lead_id: lead.id,
            performed_by: caller.uid,
            activity_type: "note",
            title: "Lead imported",
            description: fileName ? `Imported from ${fileName}` : "Imported from file",
            metadata: { importId: importId ?? null },
          });
        }
      }
    } catch (err) {
      failed++;
      errors.push(`${rowLabel(row, index)}: ${errorMessage(err)}`);
    }
  }

  for (const [index, row] of (toUpdate ?? []).entries()) {
    if (!row.matchedLeadId) continue;
    try {
      const transformed = await transformMappedData(row.mappedData, "update");
      const { error } = await supabase.from("leads").update({
        ...transformed,
      }).eq("id", row.matchedLeadId).eq("tenant_id", caller.tenantId);
      if (error) {
        failed++;
        errors.push(`${rowLabel(row, index)}: ${error.message}`);
      } else {
        updated++;
      }
    } catch (err) {
      failed++;
      errors.push(`${rowLabel(row, index)}: ${errorMessage(err)}`);
    }
  }

  if (importId) {
    await supabase.from("import_records").update({
    stats: {
      total,
      imported: created + updated,
      skipped: 0,
      failed,
    },
      status: failed > 0 && created + updated === 0 ? "failed" : "completed",
    }).eq("id", importId).eq("tenant_id", caller.tenantId);
  }

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

  return NextResponse.json({ created, updated, failed, errors: errors.slice(0, 5) });
}
