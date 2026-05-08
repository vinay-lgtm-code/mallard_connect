// Tenant-scoped Firestore paths. The `demo` flag flips the root prefix so demo
// visitors read/write under `demoTenants/{slug}/...` while production users
// stay on `tenants/{tid}/...`. The two namespaces never overlap.
//
// `demoTenants/{slug}/**` has open Firestore rules (see firestore.rules) — it's
// intentionally a public sandbox. Production `tenants/{tid}/**` is locked down
// per-tenant via custom claims.

const DEMO_ROOT = "demoTenants";
const REAL_ROOT = "tenants";

export function tenantRoot(tenantId: string, demo: boolean): string {
  return `${demo ? DEMO_ROOT : REAL_ROOT}/${tenantId}`;
}

export const tenantPath = (tid: string, demo = false) => tenantRoot(tid, demo);
export const leadsPath = (tid: string, demo = false) => `${tenantRoot(tid, demo)}/leads`;
export const leadPath = (tid: string, leadId: string, demo = false) =>
  `${tenantRoot(tid, demo)}/leads/${leadId}`;
export const activitiesPath = (tid: string, leadId: string, demo = false) =>
  `${tenantRoot(tid, demo)}/leads/${leadId}/activities`;
export const leadTasksPath = (tid: string, leadId: string, demo = false) =>
  `${tenantRoot(tid, demo)}/leads/${leadId}/tasks`;
export const tasksPath = (tid: string, demo = false) => `${tenantRoot(tid, demo)}/tasks`;
export const cadencesPath = (tid: string, demo = false) => `${tenantRoot(tid, demo)}/cadences`;
export const cadenceEnrollmentsPath = (tid: string, demo = false) =>
  `${tenantRoot(tid, demo)}/cadenceEnrollments`;
export const templatesPath = (tid: string, demo = false) => `${tenantRoot(tid, demo)}/templates`;
export const integrationsPath = (tid: string, demo = false) => `${tenantRoot(tid, demo)}/integrations`;
export const importsPath = (tid: string, demo = false) => `${tenantRoot(tid, demo)}/imports`;
export const notificationsPath = (tid: string, demo = false) => `${tenantRoot(tid, demo)}/notifications`;
export const usersPath = (tid: string, demo = false) => `${tenantRoot(tid, demo)}/users`;
export const seedMetaPath = (tid: string) => `${DEMO_ROOT}/${tid}/_meta/info`;
