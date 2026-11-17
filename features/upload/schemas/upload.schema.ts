import { z } from "zod";

export const uploadPresetSchema = z.object({
  preset: z.enum(["9d", "12d", "14d", "21d", "30d"], {
    message: "Preset must be one of: 9d, 12d, 14d, 21d, 30d",
  }),
});

export type UploadPresetInput = z.infer<typeof uploadPresetSchema>;

export interface IngestionStats {
  startTime: string;
  endTime: string;
  epochNormalized: number;
  secConverted: number;
  nullLatencies: number;
  status999Count: number;
}

export interface UploadActionResult {
  success: boolean;
  batchId?: string;
  filename: string;
  s3Key: string;
  totalRows: number;
  validRows: number;
  insertedRows: number;
  duplicateRows: number;
  stats?: IngestionStats;
  durationMs: number;
  error?: string;
}
