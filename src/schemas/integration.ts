import { z } from "zod";

export const IntegrationSchema = z.object({
  provider: z.enum(["brevo", "mab", "other"]),
  apiKey: z.string().optional(), // encrypted at rest
  listId: z.string().optional(),
  status: z.enum(["connected", "disconnected", "error"]).default("disconnected"),
  lastSyncAt: z.string().optional(),
});

export type Integration = z.infer<typeof IntegrationSchema>;
