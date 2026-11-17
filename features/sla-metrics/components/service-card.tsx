"use client";

import React from "react";
import { Card, Tag, Progress, Space } from "antd";
import {
  CheckCircleFilled,
  ExclamationCircleFilled,
} from "@ant-design/icons";
import { ServiceSlaMetric } from "../schemas/stats-query.schema";

interface ServiceCardProps {
  service: ServiceSlaMetric;
  isSelected: boolean;
  onSelect: (serviceId: string) => void;
}

export function ServiceCard({
  service,
  isSelected,
  onSelect,
}: ServiceCardProps) {
  const {
    serviceId,
    serviceName,
    totalChecks,
    failedChecks,
    availability,
    isBreached,
    p95LatencyMs,
    statusCodeBreakdown,
  } = service;

  return (
    <Card
      size="small"
      hoverable
      onClick={() => onSelect(isSelected ? "all" : serviceId)}
      className={`transition-all cursor-pointer font-mono ${
        isSelected
          ? "border-2 border-[#143F3A] shadow-md ring-1 ring-[#143F3A]/20"
          : "border border-zinc-200"
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <div>
          <span className="text-[11px] font-bold text-zinc-900 block truncate max-w-[150px]">
            {serviceName}
          </span>
          <span className="text-[10px] text-zinc-500">
            {serviceId}
          </span>
        </div>
        <Tag
          color={isBreached ? "error" : "success"}
          icon={
            isBreached ? <ExclamationCircleFilled /> : <CheckCircleFilled />
          }
          className="m-0 text-[10px] font-semibold"
        >
          {isBreached ? "BREACH" : "OK"}
        </Tag>
      </div>

      <div className="my-2">
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="text-zinc-500 text-[10px]">Availability:</span>
          <span
            className={`font-bold ${
              isBreached ? "text-rose-600" : "text-emerald-700"
            }`}
          >
            {availability.toFixed(3)}%
          </span>
        </div>
        <Progress
          percent={Math.min(100, availability)}
          status={isBreached ? "exception" : "normal"}
          strokeColor={isBreached ? "#EF5B5B" : "#5FC2AE"}
          showInfo={false}
          size={["100%", 6]}
        />
      </div>

      <div className="grid grid-cols-2 gap-2 text-[10px] pt-2 border-t border-zinc-100 text-zinc-600">
        <div>
          <span className="text-zinc-500 block">Total Checks:</span>
          <span className="font-semibold text-zinc-800">
            {totalChecks.toLocaleString()}
          </span>
        </div>
        <div>
          <span className="text-zinc-500 block">P95 Latency:</span>
          <span className="font-semibold text-zinc-800">
            {p95LatencyMs !== null
              ? `${Number(p95LatencyMs).toFixed(1)}ms`
              : "N/A"}
          </span>
        </div>
      </div>

      {failedChecks > 0 && (
        <div className="mt-2 pt-2 border-t border-zinc-100">
          <div className="text-[9px] text-zinc-500 uppercase tracking-wider mb-1">
            Failed Check Breakdown:
          </div>
          <Space wrap size={[4, 4]}>
            {statusCodeBreakdown.count500 > 0 && (
              <Tag color="volcano" className="m-0 text-[9px]">
                500: {statusCodeBreakdown.count500}
              </Tag>
            )}
            {statusCodeBreakdown.count502 > 0 && (
              <Tag color="orange" className="m-0 text-[9px]">
                502: {statusCodeBreakdown.count502}
              </Tag>
            )}
            {statusCodeBreakdown.count503 > 0 && (
              <Tag color="gold" className="m-0 text-[9px]">
                503: {statusCodeBreakdown.count503}
              </Tag>
            )}
            {statusCodeBreakdown.count999 > 0 && (
              <Tag color="red" className="m-0 text-[9px]">
                999: {statusCodeBreakdown.count999}
              </Tag>
            )}
          </Space>
        </div>
      )}
    </Card>
  );
}
