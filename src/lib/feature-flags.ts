import { isDemoMode } from "@/hooks/useAuth";

export function isCadencesTemplatesEnabled(): boolean {
  if (process.env.NEXT_PUBLIC_ENABLE_CADENCES_TEMPLATES === "true") return true;
  if (typeof window !== "undefined" && isDemoMode()) return true;
  return false;
}

export function isCadencesTemplatesEnabledServer(): boolean {
  return process.env.NEXT_PUBLIC_ENABLE_CADENCES_TEMPLATES === "true";
}
