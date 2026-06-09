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

export const CreateTemplateSchema = z.object({
  name: z.string().min(1),
  channel: z.enum(["email", "sms"]),
  subject: z.string().optional(),
  body: z.string().min(1),
});

export const UpdateTemplateSchema = CreateTemplateSchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  { message: "At least one field must be provided" },
);
