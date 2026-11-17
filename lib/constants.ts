/**
 * Centralized SLA Configuration and Thresholds.
 * 
 * Change values here to update the SLA target, comparison logic,
 * and badge labels across the entire application.
 */
export const SLA_CONFIG = {
  // Target fleet & service availability percentage commitment
  TARGET_AVAILABILITY_PERCENT: 99.9,

  // Display labels
  get TARGET_LABEL(): string {
    return `${this.TARGET_AVAILABILITY_PERCENT.toFixed(1)}%`;
  },
  get TARGET_LABEL_PRECISE(): string {
    return `${this.TARGET_AVAILABILITY_PERCENT.toFixed(3)}%`;
  },
  get HEALTHY_LABEL(): string {
    return `SLA ${this.TARGET_LABEL} HEALTHY`;
  },
  BREACHED_LABEL: "SLA BREACHED",
  PENDING_LABEL: "EVALUATING SLA...",
  NO_DATA_LABEL: "NO TELEMETRY DATA",

  // Evaluates whether an availability percentage constitutes a contract breach
  isBreached(availability: number): boolean {
    return availability < this.TARGET_AVAILABILITY_PERCENT;
  },

  // Calculate availability percentage safely
  calculateAvailability(totalChecks: number, failedChecks: number): number {
    if (totalChecks <= 0) return 100;
    return Math.round(((totalChecks - failedChecks) / totalChecks) * 100000) / 1000;
  },
} as const;

// Maximum telemetry upload file size (50 Megabytes)
export const MAX_UPLOAD_FILE_SIZE_BYTES = 50 * 1024 * 1024;
export const MAX_UPLOAD_FILE_SIZE_MB = 50;

// Required CSV telemetry header columns
export const REQUIRED_CSV_COLUMNS = ["timestamp", "service_id", "status_code"] as const;
