"use server";

import {
  getHealthChecks,
  getHealthChecksCount,
  getAvailableServices,
  getAvailableAgents,
  GetHealthChecksFilter,
} from "./db";
import { logsQuerySchema, LogsQueryInput } from "./schemas/logs-query.schema";
import { parseDateRangeBounds } from "@/lib/date";

export async function getChecksLogsAction(rawInput?: LogsQueryInput) {
  const parsed = logsQuerySchema.parse(rawInput || {});
  const {
    service,
    agent,
    status,
    statusCode,
    startDate,
    endDate,
    page,
    limit,
  } = parsed;

  const offset = (page - 1) * limit;

  // Use centralized Day.js bounds calculation
  const { start, end } = parseDateRangeBounds(
    startDate || undefined,
    endDate || undefined
  );

  const parsedCode = statusCode?.trim()
    ? parseInt(statusCode.trim(), 10)
    : undefined;

  const filter: GetHealthChecksFilter = {
    service,
    agent,
    status,
    statusCode: !isNaN(parsedCode as number) ? parsedCode : undefined,
    startDate: start,
    endDate: end,
  };

  const [checks, totalCount, availableServices, availableAgents] =
    await Promise.all([
      getHealthChecks({ filter, limit, offset }),
      getHealthChecksCount(filter),
      getAvailableServices(),
      getAvailableAgents(),
    ]);

  // Return raw database records directly with NO response mapping
  return {
    checks,
    totalCount,
    page,
    limit,
    availableServices,
    availableAgents,
  };
}
