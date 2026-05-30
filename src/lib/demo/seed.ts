import type { DemoTenantSlug } from "@/lib/mock-data";

export function isValidDemoSlug(slug: string): slug is DemoTenantSlug {
  return ["mallard", "friends-capital", "acme"].includes(slug);
}

export async function seedDemoTenantIfNeeded(_slug: DemoTenantSlug): Promise<void> {
  // Demo seeding handled server-side via /api/dev/seed-demo.
  // Client-side demo uses in-memory mock data fallback.
}

export async function resetDemoTenant(_slug: DemoTenantSlug): Promise<void> {
  // No-op in client mode.
}
