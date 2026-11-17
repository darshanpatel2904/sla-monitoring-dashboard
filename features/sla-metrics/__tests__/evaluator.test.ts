import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  evaluateSlaSummary,
  evaluateServiceMetric,
  evaluateBillingCredit,
  evaluateSlaFleet,
} from "../evaluator";
import { SLA_CONFIG } from "@/lib/constants";

describe("SLA Evaluator Module (Deep Domain Interface)", () => {
  it("calculates 100% availability when there are zero failed checks", () => {
    const summary = evaluateSlaSummary({
      totalChecks: "1000",
      failedChecks: "0",
      successChecks: "1000",
      avgLatencyMs: 45.2,
      p95LatencyMs: 120.5,
      minTimestamp: new Date("2026-11-01T00:00:00Z"),
      maxTimestamp: new Date("2026-11-10T00:00:00Z"),
    });

    assert.equal(summary.totalChecks, 1000);
    assert.equal(summary.failedChecks, 0);
    assert.equal(summary.availability, 100);
    assert.equal(summary.availabilityFormatted, "100.000%");
    assert.equal(summary.isBreached, false);
    assert.equal(summary.avgLatencyMs, 45.2);
    assert.equal(summary.p95LatencyMs, 120.5);
  });

  it("handles zero total checks safely without dividing by zero", () => {
    const summary = evaluateSlaSummary(null);

    assert.equal(summary.totalChecks, 0);
    assert.equal(summary.failedChecks, 0);
    assert.equal(summary.availability, 100);
    assert.equal(summary.isBreached, false);
    assert.equal(summary.avgLatencyMs, null);
    assert.equal(summary.p95LatencyMs, null);
  });

  it("identifies SLA breach when availability drops strictly below 99.9%", () => {
    // 998 / 1000 = 99.8% (< 99.9%)
    const summary = evaluateSlaSummary({
      totalChecks: 1000,
      failedChecks: 2,
      successChecks: 998,
      avgLatencyMs: 50,
      p95LatencyMs: 150,
      minTimestamp: null,
      maxTimestamp: null,
    });

    assert.equal(summary.availability, 99.8);
    assert.equal(summary.isBreached, true);
  });

  it("evaluates precision boundary: 99.899% is breached, 99.900% is healthy", () => {
    assert.equal(SLA_CONFIG.isBreached(99.899), true);
    assert.equal(SLA_CONFIG.isBreached(99.9), false);
    assert.equal(SLA_CONFIG.isBreached(99.901), false);
  });

  it("maps service metrics and status code breakdown correctly", () => {
    const service = evaluateServiceMetric({
      serviceId: "svc-auth",
      serviceName: "Authentication Service",
      totalChecks: "500",
      failedChecks: "5",
      successChecks: "495",
      avgLatencyMs: 62.4,
      p95LatencyMs: 210,
      count500: "2",
      count502: "1",
      count503: "1",
      count999: "1",
    });

    assert.equal(service.serviceId, "svc-auth");
    assert.equal(service.serviceName, "Authentication Service");
    assert.equal(service.totalChecks, 500);
    assert.equal(service.failedChecks, 5);
    assert.equal(service.availability, 99.0);
    assert.equal(service.isBreached, true);
    assert.deepEqual(service.statusCodeBreakdown, {
      count500: 2,
      count502: 1,
      count503: 1,
      count999: 1,
    });
  });

  it("qualifies for billing credit when a single service breaches even if fleet average is healthy", () => {
    // Fleet: 1995 / 2000 = 99.75% (breached)
    const fleetSummary = evaluateSlaSummary({
      totalChecks: 2000,
      failedChecks: 5,
      successChecks: 1995,
      avgLatencyMs: 40,
      p95LatencyMs: 100,
      minTimestamp: null,
      maxTimestamp: null,
    });

    // Service 1: 1000/1000 (100% - healthy)
    const s1 = evaluateServiceMetric({
      serviceId: "svc-billing",
      serviceName: "Billing Service",
      totalChecks: 1000,
      failedChecks: 0,
      successChecks: 1000,
      avgLatencyMs: 30,
      p95LatencyMs: 80,
      count500: 0,
      count502: 0,
      count503: 0,
      count999: 0,
    });

    // Service 2: 995/1000 (99.5% - breached)
    const s2 = evaluateServiceMetric({
      serviceId: "svc-checkout",
      serviceName: "Checkout Service",
      totalChecks: 1000,
      failedChecks: 5,
      successChecks: 995,
      avgLatencyMs: 50,
      p95LatencyMs: 120,
      count500: 5,
      count502: 0,
      count503: 0,
      count999: 0,
    });

    const credit = evaluateBillingCredit(fleetSummary, [s1, s2]);

    assert.equal(credit.qualifiesForCredit, true);
    assert.equal(credit.breachedServices.length, 1);
    assert.equal(credit.breachedServices[0].serviceId, "svc-checkout");
    assert.match(credit.reason, /Checkout Service/);
    assert.match(credit.reason, /refund credit/i);
  });

  it("does not qualify for billing credit when all services meet SLA commitment", () => {
    const fleetSummary = evaluateSlaSummary({
      totalChecks: 10000,
      failedChecks: 2, // 99.98%
      successChecks: 9998,
      avgLatencyMs: 40,
      p95LatencyMs: 90,
      minTimestamp: null,
      maxTimestamp: null,
    });

    const s1 = evaluateServiceMetric({
      serviceId: "svc-1",
      serviceName: "Service One",
      totalChecks: 5000,
      failedChecks: 1, // 99.98%
      successChecks: 4999,
      avgLatencyMs: 35,
      p95LatencyMs: 85,
      count500: 1,
      count502: 0,
      count503: 0,
      count999: 0,
    });

    const s2 = evaluateServiceMetric({
      serviceId: "svc-2",
      serviceName: "Service Two",
      totalChecks: 5000,
      failedChecks: 1, // 99.98%
      successChecks: 4999,
      avgLatencyMs: 45,
      p95LatencyMs: 95,
      count500: 1,
      count502: 0,
      count503: 0,
      count999: 0,
    });

    const credit = evaluateBillingCredit(fleetSummary, [s1, s2]);

    assert.equal(credit.qualifiesForCredit, false);
    assert.equal(credit.breachedServices.length, 0);
    assert.match(credit.reason, /No billing credits due/i);
  });

  it("orchestrates full evaluateSlaFleet output correctly", () => {
    const result = evaluateSlaFleet({
      rawFleet: {
        totalChecks: "200",
        failedChecks: "0",
        successChecks: "200",
        avgLatencyMs: 50,
        p95LatencyMs: 110,
        minTimestamp: new Date("2026-11-01T00:00:00Z"),
        maxTimestamp: new Date("2026-11-05T00:00:00Z"),
      },
      rawServices: [
        {
          serviceId: "svc-api",
          serviceName: "API Gateway",
          totalChecks: "200",
          failedChecks: "0",
          successChecks: "200",
          avgLatencyMs: 50,
          p95LatencyMs: 110,
          count500: "0",
          count502: "0",
          count503: "0",
          count999: "0",
        },
      ],
      latestBatch: null,
      totalBatches: 3,
    });

    assert.equal(result.fleet.totalChecks, 200);
    assert.equal(result.fleet.availability, 100);
    assert.equal(result.services.length, 1);
    assert.equal(result.services[0].serviceId, "svc-api");
    assert.equal(result.qualification.qualifiesForCredit, false);
    assert.equal(result.totalBatches, 3);
  });
});
