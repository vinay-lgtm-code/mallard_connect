import { z } from "zod";

const mortgageTypeEnum = z.enum([
  "first-time-buyer",
  "remortgage",
  "self-employed",
  "buy-to-let",
  "other",
]);

const isoDateString = z
  .string()
  .refine((val) => !isNaN(Date.parse(val)), { message: "Invalid date string" });

export const createLeadSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: z.string().email().optional(),
  phone: z.string().min(5),
  source: z.enum(["website", "referral", "phone", "walk-in", "social", "mab-import", "other"]).optional(),
  mortgageType: mortgageTypeEnum.optional(),
  readiness: z
    .enum(["ready-now", "1-3-months", "3-6-months", "6-12-months", "exploring"])
    .optional(),
  notes: z.string().max(2000).optional(),
  followUpDate: isoDateString.optional(),
  followUpReason: z.string().max(500).optional(),
  reminderEmails: z.array(z.string().email()).max(3).optional(),
  reminderNote: z.string().max(1000).optional(),
  tags: z.array(z.string()).optional(),
});

export const updateLeadSchema = createLeadSchema.partial();

export const qualificationSchema = z.object({
  employmentType: z
    .enum(["employed", "self-employed", "contractor", "retired", "other"])
    .optional(),
  selfEmployedYears: z.number().min(0).optional(),
  annualIncome: z.number().min(0).optional(),
  creditScoreBand: z.enum(["excellent", "good", "fair", "poor", "unknown"]).optional(),
  hasCcjs: z.boolean().optional(),
  hasDefaults: z.boolean().optional(),
  hasIva: z.boolean().optional(),
  depositAmount: z.number().min(0).optional(),
  propertyValue: z.number().min(0).optional(),
  mortgageType: mortgageTypeEnum.optional(),
  isFirstTimeBuyer: z.boolean().optional(),
  dealValue: z.number().min(0).optional(),
  estimatedCloseDate: isoDateString.optional(),
  confidence: z.number().int().min(0).max(100).optional(),
});

export type CreateLeadInput = z.infer<typeof createLeadSchema>;
export type UpdateLeadInput = z.infer<typeof updateLeadSchema>;
export type QualificationInput = z.infer<typeof qualificationSchema>;
