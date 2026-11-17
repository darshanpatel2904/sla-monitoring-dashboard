"use client";

import React, { useState } from "react";
import { Collapse, Row, Col, Button, Badge, Empty, Spin } from "antd";
import { DashboardOutlined } from "@ant-design/icons";
import { FleetStatistics } from "./fleet-statistics";
import { ServiceCard } from "./service-card";
import { SlaMetricsResult } from "../schemas/stats-query.schema";
import { SLA_CONFIG } from "@/lib/constants";

interface SlaMetricsPanelProps {
  stats?: SlaMetricsResult;
  loading: boolean;
  selectedService: string;
  onSelectService: (serviceId: string) => void;
}

export function SlaMetricsPanel({
  stats,
  loading,
  selectedService,
  onSelectService,
}: SlaMetricsPanelProps) {
  const [activeKey, setActiveKey] = useState<string | string[]>(["metrics"]);

  const total = stats?.fleet.totalChecks ?? 0;
  const availability = stats?.fleet.availability ?? 100;
  const isBreached = stats?.fleet.isBreached ?? false;
  const isExpanded = activeKey.includes("metrics");

  const collapseItems = [
    {
      key: "metrics",
      label: (
        <div className="flex items-center justify-between w-full pr-4 select-none">
          <div className="flex items-center space-x-3">
            <DashboardOutlined className="text-base text-[#143F3A]" />
            <span className="font-mono font-bold text-sm text-zinc-900">
              SLA FLEET METRICS & TELEMETRY
            </span>
            {loading ? (
              <span className="font-mono text-[11px] text-zinc-400 flex items-center gap-1.5">
                <Spin size="small" /> Loading metrics...
              </span>
            ) : total > 0 ? (
              <Badge
                status={isBreached ? "error" : "success"}
                text={
                  <span className="font-mono text-xs">
                    {availability.toFixed(3)}% Availability (Target: {SLA_CONFIG.TARGET_LABEL})
                  </span>
                }
              />
            ) : (
              <span className="font-mono text-xs text-zinc-400">
                (No telemetry records uploaded)
              </span>
            )}
          </div>
          <span className="text-xs text-zinc-500 font-mono">
            {isExpanded ? "Click to Collapse [-]" : "Click to Expand [+]"}
          </span>
        </div>
      ),
      children: (
        <div className="space-y-6 pt-2">
          {/* Top Fleet Level Stats */}
          <FleetStatistics
            fleet={stats?.fleet}
            services={stats?.services}
            qualification={stats?.qualification}
            loading={loading}
          />

          {/* Per-Service Performance Grid */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-mono font-semibold uppercase tracking-wider text-zinc-500">
                Service Performance Breakdown ({stats?.services?.length ?? 0} Services)
              </span>
              {selectedService !== "all" && (
                <Button
                  size="small"
                  type="link"
                  onClick={() => onSelectService("all")}
                  className="font-mono text-xs p-0 text-[#143F3A]"
                >
                  Clear Service Filter
                </Button>
              )}
            </div>

            {stats?.services && stats.services.length > 0 ? (
              <Row gutter={[12, 12]}>
                {stats.services.map((svc) => (
                  <Col xs={24} sm={12} md={8} lg={6} xl={4.8} key={svc.serviceId}>
                    <ServiceCard
                      service={svc}
                      isSelected={selectedService === svc.serviceId}
                      onSelect={onSelectService}
                    />
                  </Col>
                ))}
              </Row>
            ) : (
              <Empty
                description={
                  <span className="font-mono text-xs text-zinc-400">
                    No microservices reporting telemetry in this period
                  </span>
                }
              />
            )}
          </div>
        </div>
      ),
    },
  ];

  return (
    <Collapse
      activeKey={activeKey}
      onChange={(keys) => setActiveKey(keys)}
      items={collapseItems}
      className="bg-white border border-zinc-200/80 shadow-sm rounded-xl overflow-hidden font-mono"
    />
  );
}
