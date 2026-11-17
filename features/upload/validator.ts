import {
  MAX_UPLOAD_FILE_SIZE_BYTES,
  MAX_UPLOAD_FILE_SIZE_MB,
  REQUIRED_CSV_COLUMNS,
} from "@/lib/constants";

/**
 * Validates file metadata (extension, size, empty file).
 * Throws descriptive Error if invalid.
 */
export function validateCsvMetadata(filename: string, sizeBytes: number): void {
  if (!filename || !filename.toLowerCase().endsWith(".csv")) {
    throw new Error(
      "Invalid file extension: Only CSV files (.csv) are supported."
    );
  }

  if (sizeBytes <= 0) {
    throw new Error(
      "The selected file is empty (0 bytes). Please choose a valid CSV file."
    );
  }

  if (sizeBytes > MAX_UPLOAD_FILE_SIZE_BYTES) {
    throw new Error(
      `File exceeds the ${MAX_UPLOAD_FILE_SIZE_MB}MB size limit. Please upload a smaller file.`
    );
  }
}

/**
 * Validates header line contains required telemetry columns.
 */
export function validateCsvHeaderRow(headerText: string): void {
  const lines = headerText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  if (lines.length === 0) {
    throw new Error(
      "The uploaded CSV file is empty or contains no readable lines."
    );
  }

  const headerRow = lines[0].toLowerCase();
  const headerColumns = headerRow
    .split(",")
    .map((col) => col.trim().replace(/^["']|["']$/g, ""));

  const missingColumns = REQUIRED_CSV_COLUMNS.filter(
    (req) => !headerColumns.includes(req)
  );

  if (missingColumns.length > 0) {
    throw new Error(
      `Invalid CSV format: Missing required telemetry columns (${missingColumns.join(
        ", "
      )}). Please ensure your CSV includes timestamp, service_id, and status_code.`
    );
  }
}

/**
 * Validates raw bytes (checking for binary null bytes and headers).
 */
export function validateCsvBuffer(buffer: Uint8Array): void {
  // 1. Check for binary / non-text files (null bytes in the first 2KB)
  const sampleLength = Math.min(buffer.length, 2048);
  for (let i = 0; i < sampleLength; i++) {
    if (buffer[i] === 0) {
      throw new Error(
        "Invalid file content: The uploaded file appears to be a binary file, not a valid CSV document."
      );
    }
  }

  // 2. Read first chunk and validate header columns
  const headerChunk = new TextDecoder("utf-8").decode(
    buffer.slice(0, Math.min(buffer.length, 4096))
  );
  validateCsvHeaderRow(headerChunk);
}

/**
 * Safely sanitizes a filename for storage.
 */
export function sanitizeFilename(rawFilename: string): string {
  const base = rawFilename.replace(/^.*[/\\]/, "");
  return base.replace(/[^a-zA-Z0-9._-]/g, "_") || "telemetry.csv";
}
