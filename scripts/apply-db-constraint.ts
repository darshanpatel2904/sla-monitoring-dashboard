import { Pool } from "pg";
import { env } from "../lib/env";

async function main() {
  const pool = new Pool({
    connectionString: env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  const client = await pool.connect();
  try {
    console.log(
      "Connected to database. Checking for existing duplicate s3_key rows in upload_batches...",
    );

    // 1. Find all duplicate s3_key groups
    const duplicatesRes = await client.query(`
      SELECT s3_key, count(*) as count 
      FROM upload_batches 
      WHERE s3_key IS NOT NULL 
      GROUP BY s3_key 
      HAVING count(*) > 1;
    `);

    console.log(`Found ${duplicatesRes.rows.length} duplicate s3_key groups.`);

    for (const row of duplicatesRes.rows) {
      const s3Key = row.s3_key;
      // Get all batch IDs for this key, ordered by number of health checks desc, then created_at asc
      const batchesRes = await client.query(
        `
        SELECT ub.id, ub.created_at, COUNT(hc.id) as check_count
        FROM upload_batches ub
        LEFT JOIN health_checks hc ON hc.upload_batch_id = ub.id
        WHERE ub.s3_key = $1
        GROUP BY ub.id, ub.created_at
        ORDER BY check_count DESC, ub.created_at ASC;
      `,
        [s3Key],
      );

      const primaryBatch = batchesRes.rows[0];
      const redundantBatches = batchesRes.rows.slice(1);

      console.log(
        `Primary batch for ${s3Key}: ${primaryBatch.id} (${primaryBatch.check_count} checks). Re-linking and removing ${redundantBatches.length} redundant batches.`,
      );

      for (const redundant of redundantBatches) {
        // Re-link any checks
        await client.query(
          `
          UPDATE health_checks 
          SET upload_batch_id = $1 
          WHERE upload_batch_id = $2;
        `,
          [primaryBatch.id, redundant.id],
        );

        // Delete redundant batch
        await client.query(
          `
          DELETE FROM upload_batches 
          WHERE id = $1;
        `,
          [redundant.id],
        );
      }
    }

    // 2. Add unique constraint if not exists
    console.log(
      "Applying UNIQUE constraint 'uq_upload_batches_s3_key' on upload_batches(s3_key)...",
    );
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'uq_upload_batches_s3_key'
        ) THEN
          ALTER TABLE upload_batches ADD CONSTRAINT uq_upload_batches_s3_key UNIQUE (s3_key);
        END IF;
      END $$;
    `);

    console.log("Unique constraint applied successfully!");
  } finally {
    client.release();
  }
}

main().catch((err) => {
  console.error("Migration error:", err);
  process.exit(1);
});
