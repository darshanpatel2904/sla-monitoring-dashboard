"use client";

import React from "react";
import { Table, Tag, Card } from "antd";
import type { ColumnsType } from "antd/es/table";
import { GlobalOutlined } from "@ant-design/icons";
import type { HealthCheck } from "@/drizzle/schema";
import { formatUtcDateTime } from "@/lib/date";

interface LogsTableProps {
  checks: HealthCheck[];
  totalCount: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number, pageSize: number) => void;
  loading: boolean;
}

export function LogsTable({
  checks,
  totalCount,
  page,
  pageSize,
  onPageChange,
  loading,
}: LogsTableProps) {
  const columns: ColumnsType<HealthCheck> = [
    {
      title: "TIMESTAMP (UTC)",
      dataIndex: "timestamp",
      key: "timestamp",
      width: 190,
      render: (ts: string | Date) => {
        const { dateStr, timeStr } = formatUtcDateTime(ts);
        return (
          <span className="font-mono text-xs text-zinc-700">
            <span className="text-zinc-500">{dateStr}</span>{" "}
            <span className="font-semibold text-zinc-900">{timeStr}</span>
          </span>
        );
      },
    },
    {
      title: "SERVICE",
      dataIndex: "serviceName",
      key: "service",
      width: 200,
      render: (_: string, record: HealthCheck) => (
        <div>
          <span className="font-mono font-medium text-xs text-zinc-900 block truncate">
            {record.serviceName}
          </span>
          <span className="font-mono text-[10px] text-zinc-400">
            {record.serviceId}
          </span>
        </div>
      ),
    },
    {
      title: "STATUS",
      dataIndex: "statusCode",
      key: "statusCode",
      width: 130,
      render: (code: number, record: HealthCheck) => {
        let tagColor = "default";
        if (code >= 200 && code < 400) tagColor = "success";
        else if (code === 500) tagColor = "volcano";
        else if (code === 502) tagColor = "orange";
        else if (code === 503) tagColor = "gold";
        else if (code === 999) tagColor = "error";
        else tagColor = "error";

        return (
          <div className="flex orientation-row items-center gap-1.5 font-mono">
            <Tag color={tagColor} className="m-0 font-bold text-xs">
              {code}
            </Tag>
            {record.isSuccess ? (
              <span className="text-[10px] text-emerald-600 font-semibold">
                OK
              </span>
            ) : (
              <span className="text-[10px] text-rose-500 font-semibold">
                FAIL
              </span>
            )}
          </div>
        );
      },
    },
    {
      title: "LATENCY",
      dataIndex: "latencyMs",
      key: "latencyMs",
      width: 130,
      render: (latency: number | null) => {
        if (latency === null) {
          return (
            <Tag className="m-0 font-mono text-[10px] text-zinc-400 bg-zinc-100 border-dashed">
              NULL (Preserved)
            </Tag>
          );
        }

        let latencyColor = "text-emerald-700";
        if (latency > 500) latencyColor = "text-amber-600";
        if (latency > 1000) latencyColor = "text-rose-600";

        return (
          <span className={`font-mono text-xs font-semibold ${latencyColor}`}>
            {latency.toFixed(1)} ms
          </span>
        );
      },
    },
    {
      title: "AGENT / REGION",
      key: "agentRegion",
      width: 180,
      render: (_: unknown, record: HealthCheck) => (
        <div className="font-mono text-xs">
          <div className="flex items-center gap-1 text-zinc-700">
            <GlobalOutlined className="text-zinc-400 text-[11px]" />
            <span className="font-medium">{record.agent}</span>
          </div>
          <span className="text-[10px] text-zinc-400 block pl-4">
            {record.region}
          </span>
        </div>
      ),
    },
  ];

  return (
    <Card
      size="small"
      className="bg-white border border-zinc-200/80 shadow-sm rounded-xl overflow-hidden font-mono"
    >
      <div className="flex items-center justify-between pb-3 mb-2 border-b border-zinc-100">
        <div className="flex items-center gap-2">
          <span className="font-bold text-xs uppercase tracking-wider text-zinc-800">
            TELEMETRY CHECKS AUDIT LOG
          </span>
          <Tag color="cyan" className="font-mono text-[10px]">
            {totalCount.toLocaleString()} Total Records
          </Tag>
        </div>
      </div>

      <Table<HealthCheck>
        columns={columns}
        dataSource={checks}
        rowKey="id"
        loading={loading}
        size="small"
        scroll={{ x: 750 }}
        pagination={{
          current: page,
          pageSize: pageSize,
          total: totalCount,
          showSizeChanger: true,
          pageSizeOptions: ["25", "50", "100", "200"],
          onChange: onPageChange,
          showTotal: (total, range) => (
            <span className="text-xs text-zinc-500 font-mono">
              Showing {range[0]}-{range[1]} of {total.toLocaleString()} checks
            </span>
          ),
        }}
      />
    </Card>
  );
}
