"use client";

import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { DashboardHeader } from "./header";
import {
  SlaMetricsPanel,
  getSlaStatsAction,
  SlaMetricsResult,
} from "@/features/sla-metrics";
import { LogsFilterBar, LogsTable, getChecksLogsAction } from "@/features/logs";
import { UploadModal } from "@/features/upload";
import { formatDate } from "@/lib/date";

export function SlaDashboard() {
  const queryClient = useQueryClient();
  const [uploadModalOpen, setUploadModalOpen] = useState(false);

  // Filters
  const [selectedService, setSelectedService] = useState<string>("all");
  const [selectedAgent, setSelectedAgent] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "success" | "failed"
  >("all");
  const [statusCodeQuery, setStatusCodeQuery] = useState<string>("");
  const [userDateRange, setUserDateRange] = useState<{
    start: string;
    end: string;
  } | null>(null);
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(50);

  // 1. Query SLA Fleet & Service Statistics (returns deep evaluated domain result)
  const {
    data: stats,
    isLoading: statsLoading,
    refetch: refetchStats,
  } = useQuery<SlaMetricsResult>({
    queryKey: ["sla-stats"],
    queryFn: () => getSlaStatsAction(),
  });

  const totalChecks = stats?.fleet.totalChecks ?? 0;
  const fleetAvailability = stats?.fleet.availability ?? 100;
  const isBreached = stats?.fleet.isBreached ?? false;

  // Compute effective date range without triggering cascading effect renders
  const datasetMinDate = stats?.fleet?.minTimestamp
    ? formatDate(stats.fleet.minTimestamp)
    : "";
  const datasetMaxDate = stats?.fleet?.maxTimestamp
    ? formatDate(stats.fleet.maxTimestamp)
    : datasetMinDate;

  const effectiveDateRange = userDateRange ?? {
    start: datasetMinDate,
    end: datasetMaxDate,
  };

  // 2. Query Checks Telemetry Logs with active filters (Date Range)
  const {
    data: checksData,
    isLoading: checksLoading,
    refetch: refetchChecks,
  } = useQuery({
    queryKey: [
      "sla-checks",
      selectedService,
      selectedAgent,
      statusFilter,
      statusCodeQuery,
      effectiveDateRange.start,
      effectiveDateRange.end,
      page,
      pageSize,
    ],
    queryFn: () =>
      getChecksLogsAction({
        service: selectedService,
        agent: selectedAgent,
        status: statusFilter,
        statusCode: statusCodeQuery,
        startDate: effectiveDateRange.start.trim()
          ? effectiveDateRange.start.trim()
          : undefined,
        endDate: effectiveDateRange.end.trim()
          ? effectiveDateRange.end.trim()
          : undefined,
        page,
        limit: pageSize,
      }),
  });

  // Reset page to 1 whenever filters change
  const handleSelectService = (service: string) => {
    setSelectedService(service);
    setPage(1);
  };

  const handleSelectAgent = (agent: string) => {
    setSelectedAgent(agent);
    setPage(1);
  };

  const handleStatusFilterChange = (status: "all" | "success" | "failed") => {
    setStatusFilter(status);
    setPage(1);
  };

  const handleStatusCodeQueryChange = (query: string) => {
    setStatusCodeQuery(query);
    setPage(1);
  };

  const handleDateRangeChange = (range: { start: string; end: string }) => {
    setUserDateRange(range);
    setPage(1);
  };

  const handlePageChange = (newPage: number, newPageSize: number) => {
    setPage(newPage);
    setPageSize(newPageSize);
  };

  const handleResetFilters = () => {
    setSelectedService("all");
    setSelectedAgent("all");
    setStatusFilter("all");
    setStatusCodeQuery("");
    setUserDateRange(null);
    setPage(1);
  };

  const handleUploadSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ["sla-stats"] });
    queryClient.invalidateQueries({ queryKey: ["sla-checks"] });
  };

  return (
    <div className="min-h-screen bg-[#F5F2ED] flex flex-col font-mono text-zinc-900">
      {/* Header */}
      <DashboardHeader
        onOpenUpload={() => setUploadModalOpen(true)}
        fleetAvailability={fleetAvailability}
        totalChecks={totalChecks}
        isBreached={isBreached}
        loading={statsLoading}
      />

      {/* Main Single-Screen Content Area */}
      <main className="max-w-7xl mx-auto w-full px-4 sm:px-6 py-6 space-y-6 gap-5 flex flex-col flex-1">
        <SlaMetricsPanel
          stats={stats}
          loading={statsLoading}
          selectedService={selectedService}
          onSelectService={handleSelectService}
        />

        <LogsFilterBar
          selectedService={selectedService}
          onSelectService={handleSelectService}
          selectedAgent={selectedAgent}
          onSelectAgent={handleSelectAgent}
          statusFilter={statusFilter}
          onStatusFilterChange={handleStatusFilterChange}
          statusCodeQuery={statusCodeQuery}
          onStatusCodeQueryChange={handleStatusCodeQueryChange}
          dateRange={effectiveDateRange}
          onDateRangeChange={handleDateRangeChange}
          availableServices={
            stats?.services.length
              ? stats.services.map((s) => ({
                  serviceId: s.serviceId,
                  serviceName: s.serviceName,
                }))
              : checksData?.availableServices || []
          }
          availableAgents={checksData?.availableAgents || []}
          onRefresh={() => {
            refetchStats();
            refetchChecks();
          }}
          onReset={handleResetFilters}
          loading={checksLoading}
        />

        <LogsTable
          checks={checksData?.checks || []}
          totalCount={checksData?.totalCount || 0}
          page={page}
          pageSize={pageSize}
          onPageChange={handlePageChange}
          loading={checksLoading}
        />
      </main>

      {/* Upload Telemetry Modal */}
      <UploadModal
        open={uploadModalOpen}
        onClose={() => setUploadModalOpen(false)}
        onSuccess={handleUploadSuccess}
      />
    </div>
  );
}
