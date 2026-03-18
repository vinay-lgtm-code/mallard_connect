import { z } from "zod";

export const createTaskSchema = z.object({
  leadId: z.string(),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  dueDate: z.string().refine((val) => !isNaN(Date.parse(val)), { message: "Invalid date string" }),
  priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
  reminderEmails: z.array(z.string().email()).max(3),
  reminderNote: z.string().max(1000).optional(),
});

export const updateTaskSchema = createTaskSchema.partial();

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
