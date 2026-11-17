import { db } from "@/drizzle";
import { healthChecks, uploadBatches, UploadBatch } from "@/drizzle/schema";
import { eq, and, gte, lte, desc, count, sql, min, max, SQL } from "drizzle-orm";

export interface SlaFilterParams {
  startDate?: Date;
  endDate?: Date;
  service?: string;
}

function buildSlaWhere(filter: SlaFilterParams): SQL | undefined {
  const conditions: (SQL | undefined)[] = [];

  if (filter.startDate) {
    conditions.push(gte(healthChecks.timestamp, filter.startDate));
  }

  if (filter.endDate) {
    conditions.push(lte(healthChecks.timestamp, filter.endDate));
  }

  if (filter.service && filter.service !== "all") {
    conditions.push(eq(healthChecks.serviceId, filter.service));
  }

  const valid = conditions.filter((c): c is SQL => c !== undefined);
  return valid.length > 0 ? and(...valid) : undefined;
}

export async function getFleetStats(filter: SlaFilterParams) {
  const where = buildSlaWhere(filter);

  const [fleet] = await db
    .select({
      totalChecks: count(),
      failedChecks: count(
        sql`CASE WHEN ${healthChecks.isSuccess} = false THEN 1 END`
      ),
      successChecks: count(
        sql`CASE WHEN ${healthChecks.isSuccess} = true THEN 1 END`
      ),
      avgLatencyMs: sql<number | null>`ROUND(AVG(${healthChecks.latencyMs})::numeric, 1)`,
      p95LatencyMs: sql<number | null>`PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY ${healthChecks.latencyMs})`,
      minTimestamp: min(healthChecks.timestamp),
      maxTimestamp: max(healthChecks.timestamp),
    })
    .from(healthChecks)
    .where(where);

  return fleet;
}

export async function getServicesStats(filter: SlaFilterParams) {
  const where = buildSlaWhere(filter);

  return db
    .select({
      serviceId: healthChecks.serviceId,
      serviceName: healthChecks.serviceName,
      totalChecks: count(),
      failedChecks: count(
        sql`CASE WHEN ${healthChecks.isSuccess} = false THEN 1 END`
      ),
      successChecks: count(
        sql`CASE WHEN ${healthChecks.isSuccess} = true THEN 1 END`
      ),
      avgLatencyMs: sql<number | null>`ROUND(AVG(${healthChecks.latencyMs})::numeric, 1)`,
      p95LatencyMs: sql<number | null>`PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY ${healthChecks.latencyMs})`,
      count500: count(
        sql`CASE WHEN ${healthChecks.statusCode} = 500 THEN 1 END`
      ),
      count502: count(
        sql`CASE WHEN ${healthChecks.statusCode} = 502 THEN 1 END`
      ),
      count503: count(
        sql`CASE WHEN ${healthChecks.statusCode} = 503 THEN 1 END`
      ),
      count999: count(
        sql`CASE WHEN ${healthChecks.statusCode} = 999 THEN 1 END`
      ),
    })
    .from(healthChecks)
    .where(where)
    .groupBy(healthChecks.serviceId, healthChecks.serviceName)
    .orderBy(healthChecks.serviceId);
}

export async function getLatestBatch(): Promise<UploadBatch | undefined> {
  const [batch] = await db
    .select()
    .from(uploadBatches)
    .orderBy(desc(uploadBatches.createdAt))
    .limit(1);

  return batch;
}

export async function getTotalBatchesCount(): Promise<number> {
  const [result] = await db.select({ total: count() }).from(uploadBatches);
  return Number(result?.total) || 0;
}
