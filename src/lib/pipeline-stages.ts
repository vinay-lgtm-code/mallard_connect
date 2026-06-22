export const DEFAULT_PIPELINE_STAGES = [
  { name: "New Enquiry", slug: "new_enquiry", position: 0, color: "#6366f1", isTerminal: false },
  { name: "Initial Contact", slug: "initial_contact", position: 1, color: "#3b82f6", isTerminal: false },
  { name: "Not proceeded.", slug: "not_ready_yet", position: 2, color: "#f59e0b", isTerminal: false },
  { name: "Nurturing", slug: "nurturing", position: 3, color: "#22c55e", isTerminal: false },
  { name: "Decision in Principle done", slug: "decision_in_principle_done", position: 4, color: "#14b8a6", isTerminal: false },
  { name: "Ready to proceed", slug: "ready_to_proceed", position: 5, color: "#2563eb", isTerminal: false },
  { name: "Deal Done", slug: "referred_to_mab", position: 6, color: "#a855f7", isTerminal: true },
] as const;

export type DefaultPipelineStageSlug = (typeof DEFAULT_PIPELINE_STAGES)[number]["slug"];

export function getDefaultPipelineStage(slug: string) {
  return DEFAULT_PIPELINE_STAGES.find((stage) => stage.slug === slug) ?? null;
}
