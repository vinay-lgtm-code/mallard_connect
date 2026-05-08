// Per-tenant demo data dispatcher.
// `getDemoTenant()` (in @/hooks/useAuth) reads localStorage to pick a tenant slug;
// this module dispatches to mallard.ts / friends-capital.ts / acme.ts.
//
// Pages should call the get*() functions rather than reading the legacy MOCK_*
// arrays — those default to Mallard for SSR-friendly fallback only.

import * as mallard from "./mallard";
import * as friendsCapital from "./friends-capital";
import * as acme from "./acme";
import type { Lead, Task, Activity, User, Cadence, Template, CadenceEnrollment } from "@/types";

export type DemoTenantSlug = "mallard" | "friends-capital" | "acme";

const TENANTS: Record<DemoTenantSlug, typeof mallard> = {
  mallard,
  "friends-capital": friendsCapital,
  acme,
};

const DEMO_TENANT_KEY = "sequence_demo_tenant";

function readSlug(): DemoTenantSlug {
  if (typeof window === "undefined") return "mallard";
  const slug = localStorage.getItem(DEMO_TENANT_KEY) as DemoTenantSlug | null;
  return slug && slug in TENANTS ? slug : "mallard";
}

export function getMockUsers(): User[] {
  return TENANTS[readSlug()].users;
}

export function getMockLeads(): Lead[] {
  return TENANTS[readSlug()].leads;
}

export function getMockTasks(): Task[] {
  return TENANTS[readSlug()].tasks;
}

export function getMockActivities(): Activity[] {
  return TENANTS[readSlug()].activities;
}

export function getMockCadences(): Cadence[] {
  return TENANTS[readSlug()].cadences;
}

export function getMockTemplates(): Template[] {
  return TENANTS[readSlug()].templates;
}

export function getMockEnrollments(): CadenceEnrollment[] {
  return TENANTS[readSlug()].enrollments;
}

// Legacy exports (default to Mallard). New code should call the get*() functions.
export const MOCK_USERS: User[] = mallard.users;
export const MOCK_LEADS: Lead[] = mallard.leads;
export const MOCK_TASKS: Task[] = mallard.tasks;
export const MOCK_ACTIVITIES: Activity[] = mallard.activities;

export function isDemoUser(userId: string): boolean {
  return userId.startsWith("demo-");
}
