import { SLA_CONFIG } from "@/lib/constants";
import type { UploadBatch } from "@/drizzle/schema";
import type {
  RawFleetStatsRow,
  RawServiceStatsRow,
  SlaMetricSummary,
  ServiceSlaMetric,
  BillingCreditQualification,
  SlaMetricsResult,
} from "./schemas/stats-query.schema";

function parseNum(val: unknown): number {
  const n = Number(val);
  return Number.isFinite(n) ? n : 0;
}

export function evaluateSlaSummary(
  raw?: RawFleetStatsRow | null
): SlaMetricSummary {
  const totalChecks = parseNum(raw?.totalChecks);
  const failedChecks = parseNum(raw?.failedChecks);
  const successChecks = parseNum(raw?.successChecks);
  const availability = SLA_CONFIG.calculateAvailability(totalChecks, failedChecks);
  const isBreached = totalChecks > 0 && SLA_CONFIG.isBreached(availability);

  return {
    totalChecks,
    failedChecks,
    successChecks,
    availability,
    availabilityFormatted: `${availability.toFixed(3)}%`,
    isBreached,
    targetAvailability: SLA_CONFIG.TARGET_AVAILABILITY_PERCENT,
    targetFormatted: SLA_CONFIG.TARGET_LABEL_PRECISE,
    avgLatencyMs:
      raw?.avgLatencyMs !== undefined && raw?.avgLatencyMs !== null
        ? Number(raw.avgLatencyMs)
        : null,
    p95LatencyMs:
      raw?.p95LatencyMs !== undefined && raw?.p95LatencyMs !== null
        ? Number(raw.p95LatencyMs)
        : null,
    minTimestamp: raw?.minTimestamp ? new Date(raw.minTimestamp) : null,
    maxTimestamp: raw?.maxTimestamp ? new Date(raw.maxTimestamp) : null,
  };
}

export function evaluateServiceMetric(raw: RawServiceStatsRow): ServiceSlaMetric {
  const totalChecks = parseNum(raw.totalChecks);
  const failedChecks = parseNum(raw.failedChecks);
  const successChecks = parseNum(raw.successChecks);
  const availability = SLA_CONFIG.calculateAvailability(totalChecks, failedChecks);
  const isBreached = totalChecks > 0 && SLA_CONFIG.isBreached(availability);

  return {
    serviceId: raw.serviceId,
    serviceName: raw.serviceName,
    totalChecks,
    failedChecks,
    successChecks,
    availability,
    availabilityFormatted: `${availability.toFixed(3)}%`,
    isBreached,
    targetAvailability: SLA_CONFIG.TARGET_AVAILABILITY_PERCENT,
    targetFormatted: SLA_CONFIG.TARGET_LABEL_PRECISE,
    avgLatencyMs:
      raw.avgLatencyMs !== null && raw.avgLatencyMs !== undefined
        ? Number(raw.avgLatencyMs)
        : null,
    p95LatencyMs:
      raw.p95LatencyMs !== null && raw.p95LatencyMs !== undefined
        ? Number(raw.p95LatencyMs)
        : null,
    minTimestamp: null,
    maxTimestamp: null,
    statusCodeBreakdown: {
      count500: parseNum(raw.count500),
      count502: parseNum(raw.count502),
      count503: parseNum(raw.count503),
      count999: parseNum(raw.count999),
    },
  };
}

export function evaluateBillingCredit(
  fleet: SlaMetricSummary,
  services: ServiceSlaMetric[]
): BillingCreditQualification {
  if (fleet.totalChecks === 0) {
    return {
      qualifiesForCredit: false,
      reason: "No telemetry records available to assess SLA commitments.",
      breachedServices: [],
      fleetBreached: false,
    };
  }

  const breachedServices = services
    .filter((s) => s.totalChecks > 0 && s.isBreached)
    .map((s) => ({
      serviceId: s.serviceId,
      serviceName: s.serviceName,
      availability: s.availability,
    }));

  const qualifies = fleet.isBreached || breachedServices.length > 0;

  let reason =
    "All services meet the contractual 99.900% availability commitment. No billing credits due.";
  if (fleet.isBreached && breachedServices.length > 0) {
    const names = breachedServices
      .map((s) => `${s.serviceName} (${s.availability.toFixed(3)}%)`)
      .join(", ");
    reason = `Fleet availability (${fleet.availabilityFormatted}) dropped below target ${fleet.targetFormatted}. Breached services: ${names}. Automated refund credit triggered.`;
  } else if (fleet.isBreached) {
    reason = `Fleet availability (${fleet.availabilityFormatted}) dropped below target ${fleet.targetFormatted}. Automated refund credit triggered.`;
  } else if (breachedServices.length > 0) {
    const names = breachedServices
      .map((s) => `${s.serviceName} (${s.availability.toFixed(3)}%)`)
      .join(", ");
    reason = `SLA commitment breached on ${breachedServices.length} service(s): ${names}. Per contract terms, automated customer billing refund credit triggered.`;
  }

  return {
    qualifiesForCredit: qualifies,
    reason,
    breachedServices,
    fleetBreached: fleet.isBreached,
  };
}

export function evaluateSlaFleet(params: {
  rawFleet?: RawFleetStatsRow | null;
  rawServices?: RawServiceStatsRow[];
  latestBatch?: UploadBatch | null;
  totalBatches?: number;
}): SlaMetricsResult {
  const fleet = evaluateSlaSummary(params.rawFleet);
  const services = (params.rawServices || []).map(evaluateServiceMetric);
  const qualification = evaluateBillingCredit(fleet, services);

  return {
    fleet,
    services,
    qualification,
    latestBatch: params.latestBatch || null,
    totalBatches: parseNum(params.totalBatches),
  };
}
