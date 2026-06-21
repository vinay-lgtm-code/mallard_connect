import { z } from "zod";

export const DOCUMENT_CATEGORIES = [
  "proof_of_id",
  "proof_of_address",
  "bank_statement",
  "payslip",
  "tax_return",
  "credit_report",
  "valuation",
  "mortgage_offer",
  "dip",
  "insurance",
  "other",
] as const;

export const CATEGORY_LABELS: Record<(typeof DOCUMENT_CATEGORIES)[number], string> = {
  proof_of_id: "Proof of ID",
  proof_of_address: "Proof of Address",
  bank_statement: "Bank Statement",
  payslip: "Payslip",
  tax_return: "Tax Return",
  credit_report: "Credit Report",
  valuation: "Valuation",
  mortgage_offer: "Mortgage Offer",
  dip: "DIP",
  insurance: "Insurance",
  other: "Other",
};

export const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

export const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB

export const uploadDocumentSchema = z.object({
  leadId: z.string().uuid(),
  category: z.enum(DOCUMENT_CATEGORIES),
  description: z.string().max(500).optional(),
});

export type UploadDocumentInput = z.infer<typeof uploadDocumentSchema>;
