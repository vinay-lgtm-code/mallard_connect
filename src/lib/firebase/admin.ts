import * as admin from "firebase-admin";

function getApp() {
  if (admin.apps.length > 0) return admin.apps[0]!;

  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  return admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey,
    }),
  });
}

export function getFirestoreAdmin() {
  return admin.firestore(getApp());
}

export function getAuthAdmin() {
  return admin.auth(getApp());
}

/**
 * Tenant-scoped Firestore reference helpers (server-side / Admin SDK).
 * Every tenant-scoped read/write should go through one of these.
 */
export function getTenantRef(tenantId: string) {
  return getFirestoreAdmin().collection("tenants").doc(tenantId);
}

export function getTenantLeadsRef(tenantId: string) {
  return getTenantRef(tenantId).collection("leads");
}

export function getTenantCadencesRef(tenantId: string) {
  return getTenantRef(tenantId).collection("cadences");
}

export function getTenantEnrollmentsRef(tenantId: string) {
  return getTenantRef(tenantId).collection("cadenceEnrollments");
}

export function getTenantTemplatesRef(tenantId: string) {
  return getTenantRef(tenantId).collection("templates");
}

export function getTenantIntegrationsRef(tenantId: string) {
  return getTenantRef(tenantId).collection("integrations");
}

/**
 * Resolve a vanity-subdomain slug to a tenantId via the `subdomains/{slug}` map.
 * Returns null if no mapping exists.
 */
export async function resolveTenantBySubdomain(slug: string): Promise<string | null> {
  const snap = await getFirestoreAdmin().collection("subdomains").doc(slug).get();
  if (!snap.exists) return null;
  const data = snap.data();
  return (data?.tenantId as string) ?? null;
}
