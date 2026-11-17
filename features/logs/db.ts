import { db } from "@/drizzle";
import { healthChecks, HealthCheck } from "@/drizzle/schema";
import { eq, and, gte, lte, desc, count, SQL } from "drizzle-orm";

export interface GetHealthChecksFilter {
  service?: string;
  agent?: string;
  status?: "all" | "success" | "failed";
  statusCode?: number;
  startDate?: Date;
  endDate?: Date;
}

export function buildHealthChecksWhere(filter: GetHealthChecksFilter): SQL | undefined {
  const conditions: (SQL | undefined)[] = [];

  if (filter.service && filter.service !== "all") {
    conditions.push(eq(healthChecks.serviceId, filter.service));
  }

  if (filter.agent && filter.agent !== "all") {
    conditions.push(eq(healthChecks.agent, filter.agent));
  }

  if (filter.status === "success") {
    conditions.push(eq(healthChecks.isSuccess, true));
  } else if (filter.status === "failed") {
    conditions.push(eq(healthChecks.isSuccess, false));
  }

  if (filter.statusCode !== undefined && !isNaN(filter.statusCode)) {
    conditions.push(eq(healthChecks.statusCode, filter.statusCode));
  }

  if (filter.startDate) {
    conditions.push(gte(healthChecks.timestamp, filter.startDate));
  }

  if (filter.endDate) {
    conditions.push(lte(healthChecks.timestamp, filter.endDate));
  }

  const validConditions = conditions.filter((c): c is SQL => c !== undefined);
  return validConditions.length > 0 ? and(...validConditions) : undefined;
}

export async function getHealthChecks(params: {
  filter: GetHealthChecksFilter;
  limit: number;
  offset: number;
}): Promise<HealthCheck[]> {
  const where = buildHealthChecksWhere(params.filter);

  return db
    .select()
    .from(healthChecks)
    .where(where)
    .orderBy(desc(healthChecks.timestamp), desc(healthChecks.id))
    .limit(params.limit)
    .offset(params.offset);
}

export async function getHealthChecksCount(
  filter: GetHealthChecksFilter
): Promise<number> {
  const where = buildHealthChecksWhere(filter);

  const [result] = await db
    .select({ total: count() })
    .from(healthChecks)
    .where(where);

  return Number(result?.total) || 0;
}

export async function getAvailableServices(): Promise<
  { serviceId: string; serviceName: string }[]
> {
  return db
    .selectDistinct({
      serviceId: healthChecks.serviceId,
      serviceName: healthChecks.serviceName,
    })
    .from(healthChecks)
    .orderBy(healthChecks.serviceId);
}

export async function getAvailableAgents(): Promise<string[]> {
  const rows = await db
    .selectDistinct({
      agent: healthChecks.agent,
    })
    .from(healthChecks)
    .orderBy(healthChecks.agent);

  return rows.map((r) => r.agent);
}
