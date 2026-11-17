import { z } from "zod";
import type { UploadBatch } from "@/drizzle/schema";

export const statsQuerySchema = z.object({
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Start date must be YYYY-MM-DD")
    .or(z.literal(""))
    .optional(),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "End date must be YYYY-MM-DD")
    .or(z.literal(""))
    .optional(),
  service: z.string().max(64).optional().default("all"),
});

export type StatsQueryInput = z.infer<typeof statsQuerySchema>;

/**
 * Raw database query record shapes from Drizzle aggregates
 */
export interface RawFleetStatsRow {
  totalChecks: number | string;
  failedChecks: number | string;
  successChecks: number | string;
  avgLatencyMs: number | null;
  p95LatencyMs: number | null;
  minTimestamp: Date | null;
  maxTimestamp: Date | null;
}

export interface RawServiceStatsRow {
  serviceId: string;
  serviceName: string;
  totalChecks: number | string;
  failedChecks: number | string;
  successChecks: number | string;
  avgLatencyMs: number | null;
  p95LatencyMs: number | null;
  count500: number | string;
  count502: number | string;
  count503: number | string;
  count999: number | string;
}

/**
 * Deep Domain Models: Rich, typed SLA telemetry representations
 */
export interface SlaMetricSummary {
  totalChecks: number;
  failedChecks: number;
  successChecks: number;
  availability: number;
  availabilityFormatted: string;
  isBreached: boolean;
  targetAvailability: number;
  targetFormatted: string;
  avgLatencyMs: number | null;
  p95LatencyMs: number | null;
  minTimestamp: Date | null;
  maxTimestamp: Date | null;
}

export interface ServiceSlaMetric extends SlaMetricSummary {
  serviceId: string;
  serviceName: string;
  statusCodeBreakdown: {
    count500: number;
    count502: number;
    count503: number;
    count999: number;
  };
}

export interface BillingCreditQualification {
  qualifiesForCredit: boolean;
  reason: string;
  breachedServices: Array<{
    serviceId: string;
    serviceName: string;
    availability: number;
  }>;
  fleetBreached: boolean;
}

export interface SlaMetricsResult {
  fleet: SlaMetricSummary;
  services: ServiceSlaMetric[];
  qualification: BillingCreditQualification;
  latestBatch: UploadBatch | null;
  totalBatches: number;
}

// Backwards-compatible aliases for smooth transition
export type FleetStatsRow = SlaMetricSummary;
export type ServiceStatsRow = ServiceSlaMetric;
export type SlaStatsDbResult = SlaMetricsResult;
