export interface ServiceStat {
  serviceId: string;
  serviceName: string;
  totalChecks: number;
  failedChecks: number;
  successChecks: number;
  availability: number;
  slaBreached: boolean;
  avgLatencyMs: number | null;
  p95LatencyMs: number | null;
  errorCounts: {
    status500: number;
    status502: number;
    status503: number;
    status999: number;
  };
}

export interface FleetStatsResponse {
  totalChecks: number;
  failedChecks: number;
  successChecks: number;
  fleetAvailability: number;
  slaBreached: boolean;
  qualifiesForCredit: boolean;
  avgLatencyMs: number | null;
  p95LatencyMs: number | null;
  minTimestamp: string | null;
  maxTimestamp: string | null;
  services: ServiceStat[];
  totalBatches: number;
  latestBatch: {
    id: string;
    filename: string;
    createdAt: string;
  } | null;
}

export interface CleanCheckRowResponse {
  id: string;
  serviceId: string;
  serviceName: string;
  timestamp: string;
  statusCode: number;
  latencyMs: number | null;
  agent: string;
  region: string;
  isSuccess: boolean;
}

export interface ChecksQueryResponse {
  checks: CleanCheckRowResponse[];
  totalCount: number;
  page: number;
  totalPages: number;
  limit: number;
  availableAgents: string[];
  availableServices: { serviceId: string; serviceName: string }[];
}

export interface UploadBatchItem {
  id: string;
  filename: string;
  s3Key: string;
  totalRows: number;
  validRows: number;
  startTime: string | null;
  endTime: string | null;
  createdAt: string;
}
