// Tenant resolution helpers — implementation lands in step 5 (wire tenant context end-to-end).

const APP_HOSTS = new Set(["app", "www", "localhost"]);

export function parseSubdomain(host: string | null | undefined): string | null {
  if (!host) return null;
  const cleaned = host.split(":")[0]; // strip port
  const labels = cleaned.split(".");
  if (labels.length < 2) return null;
  const first = labels[0];
  if (APP_HOSTS.has(first)) return null;
  return first;
}

export async function getTenantIdFromSubdomain(_subdomain: string): Promise<string | null> {
  // Stub: in step 5 this reads `subdomains/{subdomain}` from Firestore.
  return null;
}
