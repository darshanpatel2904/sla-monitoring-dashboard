"use client";

import React from "react";
import { Row, Col, Card, Statistic, Tag, Alert, Skeleton } from "antd";
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  DatabaseOutlined,
  DollarOutlined,
} from "@ant-design/icons";
import {
  SlaMetricSummary,
  ServiceSlaMetric,
  BillingCreditQualification,
} from "../schemas/stats-query.schema";
import { SLA_CONFIG } from "@/lib/constants";
import { formatDateTime } from "@/lib/date";

interface FleetStatisticsProps {
  fleet?: SlaMetricSummary;
  services?: ServiceSlaMetric[];
  qualification?: BillingCreditQualification;
  loading: boolean;
}

export function FleetStatistics({
  fleet,
  services = [],
  qualification,
  loading,
}: FleetStatisticsProps) {
  const totalChecks = fleet?.totalChecks ?? 0;
  const availability = fleet?.availability ?? 100;
  const isBreached = fleet?.isBreached ?? false;
  const qualifiesForCredit =
    !loading && (qualification?.qualifiesForCredit ?? false);

  return (
    <div className="space-y-5 flex flex-col gap-6">
      {/* Credit Qualification Banner */}
      {qualifiesForCredit && (
        <Alert
          title="AUTOMATED SLA BREACH: BILLING CREDIT QUALIFIED"
          description={
            qualification?.reason ||
            `Service Level Agreement dropped below the ${SLA_CONFIG.TARGET_LABEL_PRECISE} commitment threshold. Automated customer billing refund credit triggered per contract terms.`
          }
          type="error"
          showIcon
          icon={<DollarOutlined />}
          className="border-rose-400 font-mono text-xs"
        />
      )}

      {/* KPI Cards Row with Loading Skeletons */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card hoverable className="h-full">
            {loading ? (
              <Skeleton active paragraph={{ rows: 2 }} />
            ) : (
              <>
                <Statistic
                  title={
                    <span className="text-xs uppercase tracking-wider text-zinc-500 font-mono">
                      Fleet Availability
                    </span>
                  }
                  value={totalChecks > 0 ? availability : 100}
                  precision={3}
                  suffix="%"
                  styles={{
                    content: {
                      color: isBreached ? "#EF5B5B" : "#143F3A",
                      fontWeight: 700,
                      fontFamily: "var(--font-geist-mono), monospace",
                    },
                  }}
                  prefix={
                    isBreached ? (
                      <CloseCircleOutlined className="text-rose-500 mr-1" />
                    ) : (
                      <CheckCircleOutlined className="text-emerald-600 mr-1" />
                    )
                  }
                />
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-[11px] text-zinc-500 font-mono">
                    Target: {SLA_CONFIG.TARGET_LABEL_PRECISE}
                  </span>
                  {totalChecks > 0 ? (
                    <Tag color={isBreached ? "error" : "success"}>
                      {isBreached ? "BREACHED" : "HEALTHY"}
                    </Tag>
                  ) : (
                    <Tag color="default">NO DATA</Tag>
                  )}
                </div>
              </>
            )}
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card hoverable className="h-full">
            {loading ? (
              <Skeleton active paragraph={{ rows: 2 }} />
            ) : (
              <>
                <Statistic
                  title={
                    <span className="text-xs uppercase tracking-wider text-zinc-500 font-mono">
                      Total Checks Ingested
                    </span>
                  }
                  value={totalChecks}
                  groupSeparator=","
                  styles={{
                    content: {
                      fontFamily: "var(--font-geist-mono), monospace",
                      fontWeight: 700,
                    },
                  }}
                  prefix={<DatabaseOutlined className="mr-1 text-zinc-500" />}
                />
                <div className="mt-2 text-[11px] text-zinc-500 font-mono">
                  {services.length} monitored microservices
                </div>
              </>
            )}
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card hoverable className="h-full">
            {loading ? (
              <Skeleton active paragraph={{ rows: 2 }} />
            ) : (
              <>
                <Statistic
                  title={
                    <span className="text-xs uppercase tracking-wider text-zinc-500 font-mono">
                      Response Latency (P95)
                    </span>
                  }
                  value={fleet?.p95LatencyMs ?? 0}
                  precision={1}
                  suffix="ms"
                  styles={{
                    content: {
                      fontFamily: "var(--font-geist-mono), monospace",
                      fontWeight: 700,
                    },
                  }}
                  prefix={
                    <ClockCircleOutlined className="mr-1 text-zinc-500" />
                  }
                />
                <div className="mt-2 text-[11px] text-zinc-500 font-mono">
                  Average:{" "}
                  {fleet?.avgLatencyMs !== null &&
                  fleet?.avgLatencyMs !== undefined
                    ? `${Number(fleet.avgLatencyMs).toFixed(1)}ms`
                    : "N/A"}
                </div>
              </>
            )}
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card hoverable className="h-full">
            {loading ? (
              <Skeleton active paragraph={{ rows: 2 }} />
            ) : (
              <>
                <div className="text-xs uppercase tracking-wider text-zinc-500 font-mono mb-2">
                  Observation Window
                </div>
                <div className="font-mono text-xs font-semibold text-zinc-800 space-y-1">
                  <div>
                    <span className="text-zinc-500 text-[10px] block">
                      Start:
                    </span>
                    {formatDateTime(fleet?.minTimestamp)}
                  </div>
                  <div>
                    <span className="text-zinc-500 text-[10px] block">
                      End:
                    </span>
                    {formatDateTime(fleet?.maxTimestamp)}
                  </div>
                </div>
              </>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
}
