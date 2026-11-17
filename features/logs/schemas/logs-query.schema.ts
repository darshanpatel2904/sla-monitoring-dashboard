import { z } from "zod";

export const logsQuerySchema = z.object({
  service: z.string().max(64).default("all"),
  agent: z.string().max(32).default("all"),
  status: z.enum(["all", "success", "failed"]).default("all"),
  statusCode: z.string().max(10).optional().default(""),
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Start date must be YYYY-MM-DD")
    .or(z.literal(""))
    .optional()
    .nullable(),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "End date must be YYYY-MM-DD")
    .or(z.literal(""))
    .optional()
    .nullable(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(10).max(200).default(50),
});

export type LogsQueryInput = z.infer<typeof logsQuerySchema>;
