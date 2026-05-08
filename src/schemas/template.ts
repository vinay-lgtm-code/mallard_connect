import { z } from "zod";

export const TemplateSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  channel: z.enum(["email", "sms"]),
  subject: z.string().optional(),
  body: z.string().min(1),
  variables: z.array(z.string()).default([]),
});

export type Template = z.infer<typeof TemplateSchema>;
