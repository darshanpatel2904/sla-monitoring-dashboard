"use client";

import React from "react";
import { Card, Select, Input, DatePicker, Button, Space, Row, Col } from "antd";
import {
  SearchOutlined,
  ReloadOutlined,
  ClearOutlined,
  CalendarOutlined,
} from "@ant-design/icons";
import { dayjs, Dayjs } from "@/lib/date";

const { RangePicker } = DatePicker;

interface LogsFilterBarProps {
  selectedService: string;
  onSelectService: (service: string) => void;
  selectedAgent: string;
  onSelectAgent: (agent: string) => void;
  statusFilter: "all" | "success" | "failed";
  onStatusFilterChange: (status: "all" | "success" | "failed") => void;
  statusCodeQuery: string;
  onStatusCodeQueryChange: (query: string) => void;
  dateRange: { start: string; end: string };
  onDateRangeChange: (range: { start: string; end: string }) => void;
  availableServices: { serviceId: string; serviceName: string }[];
  availableAgents: string[];
  onRefresh: () => void;
  onReset: () => void;
  loading: boolean;
}

export function LogsFilterBar({
  selectedService,
  onSelectService,
  selectedAgent,
  onSelectAgent,
  statusFilter,
  onStatusFilterChange,
  statusCodeQuery,
  onStatusCodeQueryChange,
  dateRange,
  onDateRangeChange,
  availableServices,
  availableAgents,
  onRefresh,
  onReset,
  loading,
}: LogsFilterBarProps) {
  const rangeValue: [Dayjs | null, Dayjs | null] | null =
    dateRange.start && dateRange.end
      ? [dayjs(dateRange.start), dayjs(dateRange.end)]
      : null;

  return (
    <Card
      size="small"
      className="bg-white border border-zinc-200/80 shadow-sm rounded-xl mb-6 font-mono text-xs"
    >
      <div className="flex flex-col gap-4 py-1">
        {/* Filter Controls Row: Service, Agent, Status, Status Code, and Actions */}
        <Row gutter={[12, 12]} align="middle">
          <Col xs={24} sm={12} md={6}>
            <div className="space-y-1.5">
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider block font-semibold">
                Target Service
              </span>
              <Select
                value={selectedService}
                onChange={onSelectService}
                className="w-full"
                options={[
                  { value: "all", label: "All Services" },
                  ...availableServices.map((s) => ({
                    value: s.serviceId,
                    label: `${s.serviceName} (${s.serviceId})`,
                  })),
                ]}
              />
            </div>
          </Col>

          <Col xs={24} sm={12} md={5}>
            <div className="space-y-1">
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider block">
                Monitoring Agent
              </span>
              <Select
                value={selectedAgent}
                onChange={onSelectAgent}
                className="w-full"
                options={[
                  { value: "all", label: "All Agents" },
                  ...availableAgents.map((a) => ({
                    value: a,
                    label: a,
                  })),
                ]}
              />
            </div>
          </Col>

          <Col xs={24} sm={12} md={5}>
            <div className="space-y-1">
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider block">
                Check Result
              </span>
              <Select
                value={statusFilter}
                onChange={onStatusFilterChange}
                className="w-full"
                options={[
                  { value: "all", label: "All Checks" },
                  { value: "success", label: "Success (2xx / 3xx)" },
                  { value: "failed", label: "Failures (4xx / 5xx / 999)" },
                ]}
              />
            </div>
          </Col>

          <Col xs={24} sm={12} md={4}>
            <div className="space-y-1">
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider block">
                Status Code
              </span>
              <Input
                placeholder="e.g. 500, 999"
                prefix={<SearchOutlined className="text-zinc-400" />}
                value={statusCodeQuery}
                onChange={(e) => onStatusCodeQueryChange(e.target.value)}
                allowClear
              />
            </div>
          </Col>

          <Col xs={24} sm={24} md={4}>
            <div className="space-y-1">
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider block opacity-0">
                Actions
              </span>
              <Space className="w-full justify-end">
                <Button
                  icon={<ReloadOutlined spin={loading} />}
                  onClick={onRefresh}
                  title="Refresh logs"
                />
                <Button
                  icon={<ClearOutlined />}
                  onClick={onReset}
                  title="Reset all filters"
                >
                  Reset
                </Button>
              </Space>
            </div>
          </Col>
        </Row>

        {/* Date Filter Row: Exclusively Date Range Selection */}
        <div className="pt-3 border-t border-zinc-100 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-zinc-600">
            <CalendarOutlined className="text-sm text-zinc-400" />
            <span className="text-[11px] uppercase tracking-wider font-semibold text-zinc-600">
              Date Range Window:
            </span>
            <span className="text-[10px] text-zinc-400">
              (Filter checks across observation interval)
            </span>
          </div>

          <RangePicker
            value={rangeValue}
            onChange={(dates) => {
              if (dates && dates[0] && dates[1]) {
                onDateRangeChange({
                  start: dates[0].format("YYYY-MM-DD"),
                  end: dates[1].format("YYYY-MM-DD"),
                });
              } else {
                onDateRangeChange({ start: "", end: "" });
              }
            }}
            allowClear
            className="w-72"
            placeholder={["Start date", "End date"]}
          />
        </div>
      </div>
    </Card>
  );
}
