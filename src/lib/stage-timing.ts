// Time-in-stage + RAG (Red/Amber/Green) helpers.
//
// The Kanban keys stages by slug (e.g. "not_ready_yet"); RAG config (expected_days,
// amber_pct) lives on pipeline_stages rows. We expose a slug-keyed config map so both
// the real Supabase path and demo mode can compute RAG the same way.

import type { Lead } from "@/types";

export type RagStatus = "green" | "amber" | "red";

export interface StageRagConfig {
  expectedDays: number | null;
  amberPct: number; // 0..100
}

export type StageRagConfigMap = Record<string, StageRagConfig>;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Whole days a lead has spent in its current stage. Uses currentStageEnteredAt when
 * available, otherwise falls back to createdAt. createdAt is stable; updatedAt is
 * bumped by a trigger on every lead edit and would reset the clock on unrelated
 * changes. (A server-side trigger now keeps currentStageEnteredAt populated, so the
 * fallback only matters for legacy/demo rows.)
 * Negative spans (clock skew / future timestamps) clamp to 0.
 */
export function daysInStage(lead: Pick<Lead, "currentStageEnteredAt" | "createdAt">, now: Date = new Date()): number {
  const raw = lead.currentStageEnteredAt ?? lead.createdAt;
  if (!raw) return 0;
  const entered = new Date(raw);
  if (Number.isNaN(entered.getTime())) return 0;
  const days = Math.floor((now.getTime() - entered.getTime()) / MS_PER_DAY);
  return days < 0 ? 0 : days;
}

/**
 * RAG status from days-in-stage vs the stage's expected duration.
 * - green:  days < amberPct% of expectedDays
 * - amber:  between that threshold and expectedDays
 * - red:    >= expectedDays
 * Returns null when expectedDays is not configured (no RAG).
 */
export function ragStatus(days: number, config: StageRagConfig | undefined): RagStatus | null {
  if (!config) return null;
  const { expectedDays } = config;
  if (expectedDays == null || expectedDays <= 0) return null;

  const amberPct = Math.min(100, Math.max(0, config.amberPct ?? 75));
  const amberThreshold = (expectedDays * amberPct) / 100;

  if (days >= expectedDays) return "red";
  if (days >= amberThreshold) return "amber";
  return "green";
}

/** Tailwind left-border class for a RAG status (null → no accent). */
export function ragBorderClass(status: RagStatus | null): string {
  switch (status) {
    case "green":
      return "border-l-4 border-l-green-500";
    case "amber":
      return "border-l-4 border-l-amber-500";
    case "red":
      return "border-l-4 border-l-red-500";
    default:
      return "";
  }
}

/** Short label, e.g. "5d in stage" / "1d in stage" / "Today". */
export function timeInStageLabel(days: number): string {
  if (days <= 0) return "Today";
  return `${days}d in stage`;
}

/**
 * Sensible defaults for demo mode, keyed by the hardcoded Kanban stage slugs.
 * Active stages get expected durations; terminal stages get none (no RAG).
 */
export const DEMO_STAGE_RAG_CONFIG: StageRagConfigMap = {
  new_enquiry: { expectedDays: 3, amberPct: 75 },
  initial_contact: { expectedDays: 7, amberPct: 75 },
  not_ready_yet: { expectedDays: 60, amberPct: 75 },
  nurturing: { expectedDays: 30, amberPct: 75 },
  ready_to_proceed: { expectedDays: 14, amberPct: 75 },
  referred_to_mab: { expectedDays: null, amberPct: 75 },
};
