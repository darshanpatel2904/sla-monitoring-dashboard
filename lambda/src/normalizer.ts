export interface RawCheckRow {
  timestamp: string;
  service_id: string;
  service_name?: string;
  status_code: string;
  latency?: string;
  latency_unit?: string;
  agent?: string;
  region?: string;
}

export interface CleanCheckRecord {
  serviceId: string;
  serviceName: string;
  timestamp: Date;
  statusCode: number;
  latencyMs: number | null;
  agent: string;
  region: string;
  isSuccess: boolean;
}

export interface NormalizationStats {
  totalRawRows: number;
  epochTimestampsNormalized: number;
  secondLatenciesConverted: number;
  nullLatenciesPreserved: number;
  status999Handled: number;
  duplicatesDeduped: number;
  finalCleanRows: number;
  startTime: Date | null;
  endTime: Date | null;
}

export function parseTimestamp(rawTs: string): { date: Date; wasEpoch: boolean } {
  const trimmed = (rawTs || "").trim();
  if (!trimmed) {
    throw new Error("Empty timestamp in raw check record");
  }

  // Check if string contains only digits (Unix epoch in seconds)
  if (/^\d+$/.test(trimmed)) {
    const epochSec = parseInt(trimmed, 10);
    const date = new Date(epochSec * 1000);
    return { date, wasEpoch: true };
  }

  // Standard ISO 8601 string (e.g. 2025-05-13T12:45:00Z)
  const date = new Date(trimmed);
  if (isNaN(date.getTime())) {
    throw new Error(`Invalid date format: ${rawTs}`);
  }
  return { date, wasEpoch: false };
}

export function parseLatencyMs(
  rawLatency?: string,
  rawUnit?: string
): { latencyMs: number | null; wasConvertedFromSeconds: boolean } {
  const valStr = (rawLatency || "").trim();
  if (!valStr) {
    return { latencyMs: null, wasConvertedFromSeconds: false };
  }

  const num = parseFloat(valStr);
  if (isNaN(num)) {
    return { latencyMs: null, wasConvertedFromSeconds: false };
  }

  const unit = (rawUnit || "").trim().toLowerCase();
  if (unit === "s") {
    return { latencyMs: Math.round(num * 1000 * 100) / 100, wasConvertedFromSeconds: true };
  }

  return { latencyMs: Math.round(num * 100) / 100, wasConvertedFromSeconds: false };
}

export function normalizeStatusCode(rawCode?: string): number {
  const trimmed = (rawCode || "").trim();
  const parsed = parseInt(trimmed, 10);
  if (isNaN(parsed)) {
    return 999;
  }
  return parsed;
}

export function isSuccessStatusCode(code: number): boolean {
  // HTTP 2xx and 3xx are successes; 4xx, 5xx, and 999 (synthetic agent failure/timeout) are failures
  return code >= 200 && code < 400;
}

export function normalizeRawChecks(rawRows: RawCheckRow[]): {
  stats: NormalizationStats;
  records: CleanCheckRecord[];
} {
  const stats: NormalizationStats = {
    totalRawRows: rawRows.length,
    epochTimestampsNormalized: 0,
    secondLatenciesConverted: 0,
    nullLatenciesPreserved: 0,
    status999Handled: 0,
    duplicatesDeduped: 0,
    finalCleanRows: 0,
    startTime: null,
    endTime: null,
  };

  const cleanedRecords: CleanCheckRecord[] = [];
  const seenDeduplicationKeys = new Set<string>();

  for (const row of rawRows) {
    const { date, wasEpoch } = parseTimestamp(row.timestamp);
    if (wasEpoch) {
      stats.epochTimestampsNormalized++;
    }

    const { latencyMs, wasConvertedFromSeconds } = parseLatencyMs(
      row.latency,
      row.latency_unit
    );
    if (wasConvertedFromSeconds) {
      stats.secondLatenciesConverted++;
    }
    if (latencyMs === null) {
      stats.nullLatenciesPreserved++;
    }

    const statusCode = normalizeStatusCode(row.status_code);
    if (statusCode === 999) {
      stats.status999Handled++;
    }

    const serviceId = (row.service_id || "").trim();
    const serviceName = (row.service_name || row.service_id || "").trim();
    const agent = (row.agent || "").trim();
    const region = (row.region || "").trim();
    const isSuccess = isSuccessStatusCode(statusCode);

    // Deduplication idempotency key: (service_id, timestamp_iso, agent)
    const dedupKey = `${serviceId}#${date.toISOString()}#${agent}`;
    if (seenDeduplicationKeys.has(dedupKey)) {
      stats.duplicatesDeduped++;
      continue;
    }
    seenDeduplicationKeys.add(dedupKey);

    cleanedRecords.push({
      serviceId,
      serviceName,
      timestamp: date,
      statusCode,
      latencyMs,
      agent,
      region,
      isSuccess,
    });
  }

  // Sort chronologically by timestamp ASC, then serviceId, then agent
  cleanedRecords.sort((a, b) => {
    const diff = a.timestamp.getTime() - b.timestamp.getTime();
    if (diff !== 0) return diff;
    const sDiff = a.serviceId.localeCompare(b.serviceId);
    if (sDiff !== 0) return sDiff;
    return a.agent.localeCompare(b.agent);
  });

  stats.finalCleanRows = cleanedRecords.length;
  if (cleanedRecords.length > 0) {
    stats.startTime = cleanedRecords[0].timestamp;
    stats.endTime = cleanedRecords[cleanedRecords.length - 1].timestamp;
  }

  return { stats, records: cleanedRecords };
}
