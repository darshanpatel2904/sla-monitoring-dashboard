import { Pool, PoolClient } from "pg";
import { CleanCheckRecord, NormalizationStats } from "./normalizer";

let poolInstance: Pool | null = null;

export function getDatabasePool(databaseUrl: string): Pool {
  if (!poolInstance) {
    poolInstance = new Pool({
      connectionString: databaseUrl,
      ssl: { rejectUnauthorized: false },
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });
  }
  return poolInstance;
}

export interface IngestionResult {
  uploadBatchId: string;
  totalRows: number;
  validRows: number;
  insertedRows: number;
  duplicateRows: number;
}

export async function persistCleanChecks(
  pool: Pool,
  params: {
    filename: string;
    s3Key: string;
    stats: NormalizationStats;
    records: CleanCheckRecord[];
  }
): Promise<IngestionResult> {
  const client: PoolClient = await pool.connect();
  try {
    // 0. Check if this s3_key was already processed (idempotency guard)
    const existingBatch = await client.query(
      `SELECT id, total_rows, valid_rows FROM upload_batches WHERE s3_key = $1 LIMIT 1;`,
      [params.s3Key]
    );
    if (existingBatch.rows.length > 0) {
      return {
        uploadBatchId: existingBatch.rows[0].id,
        totalRows: existingBatch.rows[0].total_rows,
        validRows: existingBatch.rows[0].valid_rows,
        insertedRows: 0,
        duplicateRows: existingBatch.rows[0].valid_rows,
      };
    }

    await client.query("BEGIN");

    // 1. Create upload_batches record
    const batchRes = await client.query(
      `INSERT INTO upload_batches (filename, s3_key, total_rows, valid_rows, start_time, end_time)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id;`,
      [
        params.filename,
        params.s3Key,
        params.stats.totalRawRows,
        params.stats.finalCleanRows,
        params.stats.startTime,
        params.stats.endTime,
      ]
    );
    const uploadBatchId: string = batchRes.rows[0].id;

    // 2. Batch insert health_checks with ON CONFLICT DO NOTHING
    // Chunk size of 1,000 rows * 9 parameters = 9,000 params (safe under 65,535 limit)
    const CHUNK_SIZE = 1000;
    let insertedRowsCount = 0;

    for (let i = 0; i < params.records.length; i += CHUNK_SIZE) {
      const chunk = params.records.slice(i, i + CHUNK_SIZE);
      const values: unknown[] = [];
      const rowPlaceholders: string[] = [];

      chunk.forEach((rec, idx) => {
        const offset = idx * 9;
        rowPlaceholders.push(
          `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8}, $${offset + 9})`
        );
        values.push(
          rec.serviceId,
          rec.serviceName,
          rec.timestamp,
          rec.statusCode,
          rec.latencyMs,
          rec.agent,
          rec.region,
          rec.isSuccess,
          uploadBatchId
        );
      });

      const sql = `
        INSERT INTO health_checks (
          service_id, service_name, timestamp, status_code, latency_ms, agent, region, is_success, upload_batch_id
        ) VALUES ${rowPlaceholders.join(", ")}
        ON CONFLICT (service_id, timestamp, agent) DO NOTHING;
      `;

      const insertResult = await client.query(sql, values);
      insertedRowsCount += insertResult.rowCount ?? 0;
    }

    await client.query("COMMIT");

    return {
      uploadBatchId,
      totalRows: params.stats.totalRawRows,
      validRows: params.stats.finalCleanRows,
      insertedRows: insertedRowsCount,
      duplicateRows: params.stats.finalCleanRows - insertedRowsCount + params.stats.duplicatesDeduped,
    };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
