import { NextRequest, NextResponse } from "next/server";
import { getFirestoreAdmin, getAuthAdmin } from "@/lib/firebase/admin";
import { Timestamp } from "firebase-admin/firestore";

/**
 * Provisions a new tenant from the onboarding wizard.
 * - Creates the tenant doc + subdomain mapping.
 * - Sets the founder's custom claim with role + tenantId.
 * - (Future) seeds starter cadences + templates and queues invite emails.
 *
 * This is a non-demo endpoint — demo onboarding finishes purely client-side.
 */
export async function POST(request: NextRequest) {
  let body: {
    uid?: string;
    firmName?: string;
    slug?: string;
    primaryColor?: string;
    seatLimit?: number;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { uid, firmName, slug, primaryColor, seatLimit } = body;
  if (!uid || !firmName || !slug) {
    return NextResponse.json({ error: "uid, firmName, slug are required" }, { status: 400 });
  }
  if (!/^[a-z0-9-]+$/.test(slug)) {
    return NextResponse.json({ error: "Slug must be lowercase alphanumeric with dashes" }, { status: 400 });
  }

  const db = getFirestoreAdmin();
  const auth = getAuthAdmin();

  // Reject if slug already taken.
  const slugSnap = await db.collection("subdomains").doc(slug).get();
  if (slugSnap.exists) {
    return NextResponse.json({ error: "That vanity URL is already taken" }, { status: 409 });
  }

  const tenantRef = db.collection("tenants").doc();
  const now = Timestamp.now();

  await Promise.all([
    tenantRef.set({
      name: firmName,
      slug,
      primaryColor: primaryColor ?? "#1A5653",
      plan: "trial",
      seatLimit: seatLimit ?? 5,
      createdAt: now,
    }),
    db.collection("subdomains").doc(slug).set({ tenantId: tenantRef.id }),
    auth.setCustomUserClaims(uid, { role: "manager", tenantId: tenantRef.id }),
    db.collection("users").doc(uid).set({ tenantId: tenantRef.id }, { merge: true }),
  ]);

  return NextResponse.json({ tenantId: tenantRef.id, slug }, { status: 201 });
}
