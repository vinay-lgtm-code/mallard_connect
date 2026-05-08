import { z } from "zod";

export const CadenceTriggerSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("stage_entered"), stageId: z.string() }),
  z.object({ type: z.literal("manual") }),
  z.object({ type: z.literal("lead_created") }),
]);

export const CadenceStepSchema = z.object({
  delayDays: z.number().int().min(0),
  channel: z.enum(["email", "sms", "task", "reminder"]),
  templateId: z.string().optional(),
  subject: z.string().optional(),
  body: z.string().optional(),
});

export const CadenceSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  trigger: CadenceTriggerSchema,
  steps: z.array(CadenceStepSchema).min(1),
  isActive: z.boolean().default(true),
});

export type Cadence = z.infer<typeof CadenceSchema>;
export type CadenceStep = z.infer<typeof CadenceStepSchema>;
export type CadenceTrigger = z.infer<typeof CadenceTriggerSchema>;
