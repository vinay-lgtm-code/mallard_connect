import { createHash, randomBytes } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getEmailDomain,
  isValidDomain,
  isValidEmail,
  normalizeDomain,
  normalizeEmail,
} from "@/lib/provisioning/domains";

export interface CreateOrganizationProvisionInput {
  domain: string;
  companyName: string;
  orgPocName: string;
  orgPocEmail: string;
  createdByEmail: string;
}

export interface PreparedOrganizationProvision {
  domain: string;
  normalizedDomain: string;
  companyName: string;
  orgPocName: string;
  orgPocEmail: string;
  normalizedOrgPocEmail: string;
  createdByEmail: string;
}

export function prepareOrganizationProvision(
  input: CreateOrganizationProvisionInput,
): PreparedOrganizationProvision {
  const normalizedDomain = normalizeDomain(input.domain);
  const normalizedOrgPocEmail = normalizeEmail(input.orgPocEmail);
  const orgPocDomain = getEmailDomain(normalizedOrgPocEmail);

  if (!isValidDomain(normalizedDomain)) {
    throw new Error("Enter a valid email domain.");
  }
  if (!input.companyName.trim()) {
    throw new Error("Company name is required.");
  }
  if (!input.orgPocName.trim()) {
    throw new Error("Org PoC name is required.");
  }
  if (!isValidEmail(normalizedOrgPocEmail)) {
    throw new Error("Enter a valid Org PoC email.");
  }
  if (orgPocDomain !== normalizedDomain) {
    throw new Error("Org PoC email must belong to the provisioned domain.");
  }

  return {
    domain: input.domain.trim(),
    normalizedDomain,
    companyName: input.companyName.trim(),
    orgPocName: input.orgPocName.trim(),
    orgPocEmail: input.orgPocEmail.trim(),
    normalizedOrgPocEmail,
    createdByEmail: normalizeEmail(input.createdByEmail),
  };
}

export function createClaimToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: hashClaimToken(token) };
}

export function hashClaimToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function findActiveProvisionByEmail(
  supabase: SupabaseClient,
  email: string,
) {
  const normalizedEmail = normalizeEmail(email);
  const domain = getEmailDomain(normalizedEmail);
  if (!domain) return null;

  const { data, error } = await supabase
    .from("organization_provisions")
    .select("*")
    .eq("normalized_domain", domain)
    .in("status", ["provisioned", "claimed"])
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function findProvisionByClaimToken(
  supabase: SupabaseClient,
  token: string,
) {
  const tokenHash = hashClaimToken(token);
  const { data, error } = await supabase
    .from("organization_provisions")
    .select("*")
    .eq("claim_token_hash", tokenHash)
    .eq("status", "provisioned")
    .gt("claim_token_expires_at", new Date().toISOString())
    .maybeSingle();

  if (error) throw error;
  return data;
}

export function isProvisionedPocEmail(provision: { normalized_org_poc_email?: string } | null, email: string): boolean {
  return !!provision && provision.normalized_org_poc_email === normalizeEmail(email);
}
