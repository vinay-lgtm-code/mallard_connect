import type { UserRole } from "@/types";

export type RoleCapability =
  | "viewAllPipeline"
  | "createLeads"
  | "assignLeads"
  | "manageTeam"
  | "viewReports"
  | "viewForecast"
  | "importLeads"
  | "manageTemplates"
  | "manageCadences"
  | "manageTenantSettings";

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Admin",
  manager: "Manager",
  advisor: "Advisor",
  case_manager: "Case Manager",
};

const ROLE_CAPABILITIES: Record<UserRole, ReadonlySet<RoleCapability>> = {
  admin: new Set([
    "viewAllPipeline",
    "createLeads",
    "assignLeads",
    "manageTeam",
    "viewReports",
    "viewForecast",
    "importLeads",
    "manageTemplates",
    "manageCadences",
    "manageTenantSettings",
  ]),
  manager: new Set([
    "viewAllPipeline",
    "createLeads",
    "assignLeads",
    "manageTeam",
    "viewReports",
    "viewForecast",
    "importLeads",
    "manageTemplates",
    "manageCadences",
    "manageTenantSettings",
  ]),
  case_manager: new Set([
    "viewAllPipeline",
    "createLeads",
    "assignLeads",
  ]),
  advisor: new Set([
    "createLeads",
  ]),
};

export function roleLabel(role: UserRole | string | null | undefined): string {
  if (role && role in ROLE_LABELS) return ROLE_LABELS[role as UserRole];
  return "User";
}

export function hasCapability(
  role: UserRole | string | null | undefined,
  capability: RoleCapability,
): boolean {
  if (!role || !(role in ROLE_CAPABILITIES)) return false;
  return ROLE_CAPABILITIES[role as UserRole].has(capability);
}

export function hasAnyCapability(
  role: UserRole | string | null | undefined,
  capabilities: RoleCapability[],
): boolean {
  return capabilities.some((capability) => hasCapability(role, capability));
}

export function isTenantManager(role: UserRole | string | null | undefined): boolean {
  return role === "admin" || role === "manager";
}
