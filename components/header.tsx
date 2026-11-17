"use client";

import React from "react";
import { Button, Tag, Space, Skeleton } from "antd";
import {
  CloudUploadOutlined,
  CheckCircleFilled,
  ExclamationCircleFilled,
  SafetyCertificateOutlined,
  SyncOutlined,
} from "@ant-design/icons";
import { SLA_CONFIG } from "@/lib/constants";

interface HeaderProps {
  onOpenUpload: () => void;
  fleetAvailability?: number;
  totalChecks?: number;
  isBreached?: boolean;
  loading?: boolean;
}

export function DashboardHeader({
  onOpenUpload,
  fleetAvailability = 100,
  totalChecks = 0,
  isBreached = false,
  loading = false,
}: HeaderProps) {
  return (
    <header className="border-b border-zinc-200/80 bg-white/95 backdrop-blur-md sticky top-0 z-30 px-6 py-3.5 shadow-sm font-mono">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
        {/* Title and Branding */}
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-xl bg-[#143F3A] flex items-center justify-center text-white shadow-sm">
            <SafetyCertificateOutlined className="text-lg" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold tracking-tight text-zinc-900 m-0">
                SLA MONITORING & OBSERVABILITY
              </h1>

              {/* Status Badge with Skeleton Loading to prevent flash of wrong status */}
              {loading ? (
                <Skeleton.Button
                  active
                  size="small"
                  className="!h-5 !w-32 !min-w-[120px] rounded"
                />
              ) : totalChecks === 0 ? (
                <Tag
                  color="default"
                  className="font-bold text-[10px] m-0"
                  icon={<SyncOutlined />}
                >
                  {SLA_CONFIG.NO_DATA_LABEL}
                </Tag>
              ) : (
                <Tag
                  color={isBreached ? "error" : "success"}
                  icon={
                    isBreached ? (
                      <ExclamationCircleFilled />
                    ) : (
                      <CheckCircleFilled />
                    )
                  }
                  className="font-bold text-[10px] m-0 transition-all"
                >
                  {isBreached
                    ? `${SLA_CONFIG.BREACHED_LABEL} (${fleetAvailability.toFixed(3)}%)`
                    : `${SLA_CONFIG.HEALTHY_LABEL} (${fleetAvailability.toFixed(3)}%)`}
                </Tag>
              )}
            </div>
            <p className="text-[11px] text-zinc-500 m-0">
              Contractual uptime tracking & automated reliability monitoring
            </p>
          </div>
        </div>

        {/* User-friendly upload action */}
        <Space size="middle">
          <Button
            type="primary"
            icon={<CloudUploadOutlined />}
            onClick={onOpenUpload}
            className="font-mono text-xs font-semibold shadow-sm bg-[#143F3A] hover:!bg-[#1c564f]"
          >
            Upload Telemetry Data
          </Button>
        </Space>
      </div>
    </header>
  );
}
