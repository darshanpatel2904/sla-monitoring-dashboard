import * as fs from "fs";
import * as path from "path";
import { parse } from "csv-parse/sync";
import { normalizeRawChecks, RawCheckRow } from "../lambda/src/normalizer";

interface BenchmarkLog {
  days: number;
  start: string;
  incidents: Record<string, string>;
}

async function verifyAllDatasets() {
  const incidentLogPath = path.join(process.cwd(), "dataset_incident_log.json");
  const incidentLog: Record<string, BenchmarkLog> = JSON.parse(
    fs.readFileSync(incidentLogPath, "utf-8")
  );

  console.log("==================================================================");
  console.log(" SLA MONITORING DASHBOARD: END-TO-END BENCHMARK VERIFICATION");
  console.log("==================================================================\n");

  let allPassed = true;

  for (const [filename, expectedMeta] of Object.entries(incidentLog)) {
    const filePath = path.join(process.cwd(), filename);
    if (!fs.existsSync(filePath)) {
      console.error(`Missing dataset: ${filename}`);
      allPassed = false;
      continue;
    }

    const rawCsv = fs.readFileSync(filePath, "utf-8");
    const rawRows = parse(rawCsv, { columns: true, skip_empty_lines: true, trim: true }) as RawCheckRow[];
    const { stats, records } = normalizeRawChecks(rawRows);

    console.log(`FILE: ${filename}`);
    console.log(`  Expected Days: ${expectedMeta.days} (start: ${expectedMeta.start})`);
    console.log(`  Raw Rows: ${stats.totalRawRows.toLocaleString()}`);
    console.log(`  Cleaned Valid Checks: ${stats.finalCleanRows.toLocaleString()}`);
    console.log(`  Epoch Timestamps Normalized: ${stats.epochTimestampsNormalized}`);
    console.log(`  Second Latencies Converted: ${stats.secondLatenciesConverted}`);
    console.log(`  Null Latencies Preserved: ${stats.nullLatenciesPreserved}`);
    console.log(`  Deduplicated Checks: ${stats.duplicatesDeduped}`);
    console.log(`  Status 999 Handled: ${stats.status999Handled}`);

    // Verify time range
    const fileStartDate = stats.startTime?.toISOString().slice(0, 10);
    if (fileStartDate !== expectedMeta.start) {
      console.error(`  [FAIL] Expected start date ${expectedMeta.start}, got ${fileStartDate}`);
      allPassed = false;
    } else {
      console.log(`  [PASS] Start date matches benchmark: ${fileStartDate}`);
    }

    // Check incidents
    console.log(`  Verifying Expected Incidents from Benchmark:`);
    for (const [incidentDesc, timeWindow] of Object.entries(expectedMeta.incidents)) {
      const serviceId = incidentDesc.split(" ")[0];
      const serviceFailures = records.filter(
        (r) => r.serviceId === serviceId && !r.isSuccess
      );

      console.log(`    - Incident: "${incidentDesc}" -> ${timeWindow}`);
      console.log(`      Total service failures detected for ${serviceId}: ${serviceFailures.length}`);

      if (serviceFailures.length === 0) {
        console.error(`      [FAIL] No failures detected for ${serviceId}!`);
        allPassed = false;
      } else {
        console.log(`      [PASS] Incidents detected and isolated.`);
      }
    }
    console.log("------------------------------------------------------------------\n");
  }

  if (allPassed) {
    console.log("ALL BENCHMARK DATASETS PASSED VERIFICATION!");
  } else {
    console.error("SOME BENCHMARK VERIFICATIONS FAILED!");
    process.exit(1);
  }
}

verifyAllDatasets().catch((err) => {
  console.error("Verification execution error:", err);
  process.exit(1);
});
