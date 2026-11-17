import { db } from "@/drizzle";
import { uploadBatches, UploadBatch } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function getUploadBatchById(id: string): Promise<UploadBatch | undefined> {
  const [batch] = await db
    .select()
    .from(uploadBatches)
    .where(eq(uploadBatches.id, id))
    .limit(1);

  return batch;
}

export async function getUploadBatchByS3Key(s3Key: string): Promise<UploadBatch | undefined> {
  const [batch] = await db
    .select()
    .from(uploadBatches)
    .where(eq(uploadBatches.s3Key, s3Key))
    .limit(1);

  return batch;
}
