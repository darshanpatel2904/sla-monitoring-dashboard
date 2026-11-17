"use server";

import {
  getFleetStats,
  getServicesStats,
  getLatestBatch,
  getTotalBatchesCount,
} from "./db";
import {
  statsQuerySchema,
  StatsQueryInput,
  SlaMetricsResult,
} from "./schemas/stats-query.schema";
import { evaluateSlaFleet } from "./evaluator";
import { parseDateRangeBounds } from "@/lib/date";

export async function getSlaStatsAction(
  rawInput?: StatsQueryInput
): Promise<SlaMetricsResult> {
  const parsed = statsQuerySchema.parse(rawInput || {});
  const { startDate, endDate, service } = parsed;

  const { start, end } = parseDateRangeBounds(startDate, endDate);

  const filter = { startDate: start, endDate: end, service };

  const [fleet, services, latestBatch, totalBatches] = await Promise.all([
    getFleetStats(filter),
    getServicesStats(filter),
    getLatestBatch(),
    getTotalBatchesCount(),
  ]);

  return evaluateSlaFleet({
    rawFleet: fleet,
    rawServices: services,
    latestBatch,
    totalBatches,
  });
}
