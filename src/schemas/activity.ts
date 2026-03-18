import { z } from "zod";

export const createActivitySchema = z.object({
  leadId: z.string(),
  activityType: z.enum(["call", "email", "meeting", "note", "sms", "whatsapp", "stage-change"]),
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type CreateActivityInput = z.infer<typeof createActivitySchema>;
