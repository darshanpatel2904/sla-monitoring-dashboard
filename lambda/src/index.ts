import { S3Event, Context } from "aws-lambda";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { parse } from "csv-parse/sync";
import { normalizeRawChecks, RawCheckRow } from "./normalizer";
import { getDatabasePool, persistCleanChecks, IngestionResult } from "./db";

const s3Client = new S3Client({
  region: process.env.AWS_REGION || "ap-south-1",
});

export const handler = async (
  event: S3Event | { Records?: Array<{ s3: { bucket: { name: string }; object: { key: string } } }> },
  context?: Context
) => {
  console.log("Received Lambda invocation event:", JSON.stringify(event));

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL environment variable is missing");
  }

  const pool = getDatabasePool(databaseUrl);
  const results: IngestionResult[] = [];

  if (!event.Records || event.Records.length === 0) {
    console.warn("No S3 records found in event.");
    return {
      statusCode: 200,
      body: JSON.stringify({ message: "No S3 records to process" }),
    };
  }

  for (const record of event.Records) {
    const bucketName = record.s3.bucket.name;
    const rawKey = record.s3.object.key;
    const s3Key = decodeURIComponent(rawKey.replace(/\+/g, " "));
    const filename = s3Key.split("/").pop() || s3Key;

    console.log(`Processing file from s3://${bucketName}/${s3Key} (filename: ${filename})`);

    // 1. Fetch file stream from S3
    const getObjectRes = await s3Client.send(
      new GetObjectCommand({
        Bucket: bucketName,
        Key: s3Key,
      })
    );

    if (!getObjectRes.Body) {
      throw new Error(`S3 object body is empty for key: ${s3Key}`);
    }

    const csvContent = await getObjectRes.Body.transformToString("utf-8");

    // 2. Parse CSV
    const rawRows = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    }) as RawCheckRow[];

    console.log(`Parsed ${rawRows.length} raw rows from ${filename}`);

    // 3. Normalize rows (Ticket 01 Cleaning Specification)
    const { stats, records } = normalizeRawChecks(rawRows);
    console.log(`Normalization stats for ${filename}:`, JSON.stringify(stats));

    // 4. Persist to Postgres
    const ingestionResult = await persistCleanChecks(pool, {
      filename,
      s3Key,
      stats,
      records,
    });

    console.log(`Successfully persisted ${ingestionResult.insertedRows} checks for batch ${ingestionResult.uploadBatchId}`);
    results.push(ingestionResult);
  }

  return {
    statusCode: 200,
    body: JSON.stringify({
      message: "Ingestion and normalization completed successfully",
      batchesProcessed: results.length,
      results,
    }),
  };
};
