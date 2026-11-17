import dayjs, { Dayjs } from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

// Initialize plugins
dayjs.extend(utc);
dayjs.extend(timezone);

export { dayjs };
export type { Dayjs };

/**
 * Format date to standard YYYY-MM-DD
 */
export function formatDate(date?: string | Date | null): string {
  if (!date) return "";
  return dayjs(date).format("YYYY-MM-DD");
}

/**
 * Format datetime to standard YYYY-MM-DD HH:mm:ss
 */
export function formatDateTime(date?: string | Date | null): string {
  if (!date) return "N/A";
  return dayjs(date).format("YYYY-MM-DD HH:mm:ss");
}

/**
 * Format UTC timestamp split into date and time for audit logs table
 */
export function formatUtcDateTime(date?: string | Date | null): {
  dateStr: string;
  timeStr: string;
} {
  if (!date) return { dateStr: "-", timeStr: "-" };
  const d = dayjs(date).utc();
  return {
    dateStr: d.format("YYYY-MM-DD"),
    timeStr: d.format("HH:mm:ss"),
  };
}

/**
 * Convert Date range strings to UTC start and end bounds
 */
export function parseDateRangeBounds(startDate?: string, endDate?: string): {
  start?: Date;
  end?: Date;
} {
  const start =
    startDate && startDate.trim()
      ? dayjs.utc(startDate.trim()).startOf("day").toDate()
      : undefined;

  const end =
    endDate && endDate.trim()
      ? dayjs.utc(endDate.trim()).endOf("day").toDate()
      : undefined;

  return { start, end };
}
