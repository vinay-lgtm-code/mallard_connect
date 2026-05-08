"use client";

// Local-storage backed wizard state — demo-grade only.
// Real signup flow will pass this through /api/onboarding/provision and
// then clear the local state.

const KEY = "sequence_onboarding";

export type DataSource = "brevo" | "mab" | "other";

export type OnboardingState = {
  firmName?: string;
  slug?: string;
  primaryColor?: string;
  logoUrl?: string;
  invites?: { email: string; fullName?: string; role: "manager" | "advisor" }[];
  dataSource?: DataSource;
  brevoApiKey?: string;
  otherCrmName?: string;
  importedLeadCount?: number;
  selectedCadenceSlugs?: string[];
};

export function readOnboarding(): OnboardingState {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as OnboardingState) : {};
  } catch {
    return {};
  }
}

export function writeOnboarding(patch: Partial<OnboardingState>) {
  const current = readOnboarding();
  const next = { ...current, ...patch };
  localStorage.setItem(KEY, JSON.stringify(next));
}

export function clearOnboarding() {
  localStorage.removeItem(KEY);
}
