"use server";

import * as fs from "fs";
import * as path from "path";
import { uploadToS3 } from "@/services/s3";
import { invokeDataCleanerLambda } from "@/services/lambda";
import { env } from "@/lib/env";
import {
  uploadPresetSchema,
  UploadActionResult,
} from "./schemas/upload.schema";
import {
  validateCsvMetadata,
  validateCsvBuffer,
  sanitizeFilename,
} from "./validator";

const PRESET_FILES: Record<string, string> = {
  "9d": "monitoring_checks_9d_seed101.csv",
  "12d": "monitoring_checks_12d_seed505.csv",
  "14d": "monitoring_checks_14d_seed202.csv",
  "21d": "monitoring_checks_21d_seed303.csv",
  "30d": "monitoring_checks_30d_seed404.csv",
};

export async function uploadCustomCsvAction(
  formData: FormData
): Promise<UploadActionResult> {
  const startMs = Date.now();
  const file = formData.get("file") as File | null;

  if (!file) {
    throw new Error("No file selected. Please choose a CSV file to upload.");
  }

  // 1. Validate metadata
  validateCsvMetadata(file.name, file.size);
  const sanitizedFilename = sanitizeFilename(file.name || "telemetry.csv");

  // 2. Inspect buffer content
  const arrayBuffer = await file.arrayBuffer();
  const fileBuffer = Buffer.from(arrayBuffer);
  validateCsvBuffer(fileBuffer);

  const timestamp = Date.now();
  const s3Key = `uploads/${timestamp}-${sanitizedFilename}`;

  try {
    // 3. Upload raw CSV to cloud storage
    await uploadToS3({
      key: s3Key,
      body: fileBuffer,
      contentType: "text/csv",
    });

    // 4. Invoke automated validation and cleaner worker
    const lambdaResult = await invokeDataCleanerLambda({
      s3Bucket: env.S3_BUCKET_NAME,
      s3Key,
      filename: sanitizedFilename,
    });

    if (!lambdaResult.success) {
      throw new Error(lambdaResult.error || "Telemetry data processing failed.");
    }

    return {
      success: true,
      batchId: lambdaResult.batchId,
      filename: sanitizedFilename,
      s3Key,
      totalRows: lambdaResult.totalRows || 0,
      validRows: lambdaResult.validRows || 0,
      insertedRows: lambdaResult.insertedRows || 0,
      duplicateRows: lambdaResult.duplicateRows || 0,
      stats: lambdaResult.stats,
      durationMs: Date.now() - startMs,
    };
  } catch (err: unknown) {
    const message =
      err instanceof Error
        ? err.message
        : "Failed to process the uploaded telemetry file. Please check your data and try again.";
    throw new Error(message);
  }
}

/**
 * Server action kept for automated testing and benchmark verification if needed
 */
export async function uploadPresetCsvAction(
  presetKey: string
): Promise<UploadActionResult> {
  const startMs = Date.now();
  const { preset } = uploadPresetSchema.parse({ preset: presetKey });
  const filename = PRESET_FILES[preset];

  const filePath = path.join(/*turbopackIgnore: true*/ process.cwd(), filename);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Dataset file "${filename}" not found on server.`);
  }

  const fileBuffer = fs.readFileSync(filePath);
  validateCsvMetadata(filename, fileBuffer.length);
  validateCsvBuffer(fileBuffer);

  const timestamp = Date.now();
  const s3Key = `uploads/${timestamp}-${filename}`;

  await uploadToS3({
    key: s3Key,
    body: fileBuffer,
    contentType: "text/csv",
  });

  const lambdaResult = await invokeDataCleanerLambda({
    s3Bucket: env.S3_BUCKET_NAME,
    s3Key,
    filename,
  });

  if (!lambdaResult.success) {
    throw new Error(lambdaResult.error || "Data processing failed.");
  }

  return {
    success: true,
    batchId: lambdaResult.batchId,
    filename,
    s3Key,
    totalRows: lambdaResult.totalRows || 0,
    validRows: lambdaResult.validRows || 0,
    insertedRows: lambdaResult.insertedRows || 0,
    duplicateRows: lambdaResult.duplicateRows || 0,
    stats: lambdaResult.stats,
    durationMs: Date.now() - startMs,
  };
}
