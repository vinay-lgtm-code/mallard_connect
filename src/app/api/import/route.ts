import { NextRequest, NextResponse } from "next/server";
import { getFirestoreAdmin, getAuthAdmin } from "@/lib/firebase/admin";
import { parseImportFile } from "@/lib/import/parser";
import { findDuplicates } from "@/lib/import/dedup";
import { Timestamp } from "firebase-admin/firestore";
import type { ImportRow } from "@/lib/import/dedup";

type Lead = {
  id: string;
  phone?: string;
  email?: string;
  updatedAt?: string;
  [key: string]: unknown;
};

async function requireAdminOrManager(request: NextRequest): Promise<string | null> {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return null;

  try {
    const auth = getAuthAdmin();
    const decoded = await auth.verifyIdToken(token);
    const role = decoded.role as string | undefined;
    if (role === "admin" || role === "manager") return decoded.uid;
    return null;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  const uid = await requireAdminOrManager(request);
  if (!uid) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const contentType = request.headers.get("content-type") ?? "";

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

    const db = getFirestoreAdmin();
    const existingSnap = await db.collection("leads").get();
    const existing: Lead[] = existingSnap.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() as Omit<Lead, "id">),
    }));

    const dedupResult = findDuplicates(parsed, existing);

    return NextResponse.json(dedupResult);
  }

  const body = await request.json();

  if (body.action !== "execute") {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  const { toCreate, toUpdate }: { toCreate: ImportRow[]; toUpdate: ImportRow[] } = body;

  const db = getFirestoreAdmin();
  const now = Timestamp.now();
  const nowIso = new Date().toISOString();

  const batch = db.batch();

  for (const row of toCreate ?? []) {
    const ref = db.collection("leads").doc();
    batch.set(ref, {
      ...row.mappedData,
      status: "active",
      stage: "new-enquiry",
      createdAt: now,
      updatedAt: nowIso,
      importedBy: uid,
    });
  }

  for (const row of toUpdate ?? []) {
    if (!row.matchedLeadId) continue;
    const ref = db.collection("leads").doc(row.matchedLeadId);
    batch.update(ref, {
      ...row.mappedData,
      updatedAt: nowIso,
      lastImportedBy: uid,
    });
  }

  await batch.commit();

  await db.collection("imports").add({
    importedBy: uid,
    importedAt: now,
    created: (toCreate ?? []).length,
    updated: (toUpdate ?? []).length,
  });

  return NextResponse.json({
    created: (toCreate ?? []).length,
    updated: (toUpdate ?? []).length,
  });
}
