import { z } from "zod";

export const TenantSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  slug: z.string().regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with dashes"),
  primaryColor: z.string().optional(),
  logoUrl: z.string().url().optional(),
  plan: z.enum(["trial", "base", "growth"]).default("trial"),
  seatLimit: z.number().int().positive().default(5),
});

export type Tenant = z.infer<typeof TenantSchema>;
