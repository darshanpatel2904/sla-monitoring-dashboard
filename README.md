# Autonomous SLA Monitoring & Telemetry Audit Dashboard

A production-grade, full-stack SLA monitoring system built for automated cloud availability auditing and billing credit qualification.

The application ingests multi-agent synthetic health checks, processes messy real-world telemetry through a deployed stateless serverless cloud worker, persists cleaned records to a Postgres database, and provides an executive single-screen dashboard with collapsible SLA metrics and high-performance log auditing.

---

## 1. Architecture

```
                    ┌────────────────────────────────────────┐
                    │               Browser                  │
                    │   Next.js 16 Dashboard & Upload UI     │
                    └───────┬────────────────────────▲───────┘
                            │                        │
               1. Multipart │             4. Dynamic │ Aggregated
                   CSV File │                 SQL    │ Metrics &
                            │               Queries  │ Telemetry
                            ▼                        │
                    ┌───────────────┐        ┌───────┴───────┐
                    │   Amazon S3   │        │   Supabase    │
                    │ `sla-logs`    │        │  PostgreSQL   │
                    └───────┬───────┘        └───────▲───────┘
                            │                        │
               2. S3 Object │             3. Cleaned │ Batches
                  Created   │                Records │ (ON CONFLICT
                  Event     ▼                        │  DO NOTHING)
                    ┌───────────────┐                │
                    │  AWS Lambda   │────────────────┘
                    │ Node.js 20.x  │
                    │ Normalizer    │
                    └───────────────┘
```

### Component Breakdown & Design Rationale

| Layer                 | Technology                                                   | Hosting                           | Purpose & Justification                                                                                                                                                                                                                             |
| :-------------------- | :----------------------------------------------------------- | :-------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Frontend UI**       | Next.js 16 (App Router), React 19, Ant Design (`antd` 6.x)   | Vercel                            | Single-screen executive dashboard adhering to WebDevSimplified feature-based architecture (`features/sla-metrics`, `features/logs`, `features/upload`), styled with Ant Design tokens, collapsible stats, date filter controls, and paginated logs. |
| **Server & Security** | Next.js 16 Pure Server Actions + Zod 4 + Proxy Rate Limiting | Vercel / Edge                     | End-to-end typed Server Actions validated by Zod schemas, with Next.js 16 `proxy.ts` enforcing OWASP security headers (CSP, HSTS, XSS) and in-memory sliding-window IP rate limiting.                                                               |
| **Raw Storage**       | Amazon S3 (`sla-logs`)                                       | AWS `ap-south-1`                  | S3 serves as the durable raw ingestion buffer. Decouples client upload timeouts from normalization execution.                                                                                                                                       |
| **Stateless Worker**  | AWS Lambda (`nodejs20.x`, 512MB)                             | AWS `ap-south-1`                  | Real cloud serverless function (`sla-ingestion-worker`). Streams raw CSV from S3, executes pure functional data cleaning and deduplication, and batch-inserts into Postgres.                                                                        |
| **Persistence**       | PostgreSQL (Drizzle ORM in `drizzle/` + Pool)                | Supabase (`aws-1-ap-southeast-2`) | Persistent relational database storing audit batches (`upload_batches`) and telemetry rows (`health_checks`) with composite indexes for sub-10ms aggregations.                                                                                      |

---

## 2. Data Findings & Quality Resolutions

Multi-agent health logs collected across varying days contain substantial inconsistencies. Our stateless normalizer (`lambda/src/normalizer.ts`) was audited against all five provided benchmark datasets (`9d`, `12d`, `14d`, `21d`, `30d`).

```
========================================================================================
 Benchmark File                      Raw Rows   Cleaned   Epoch Ts   Sec Lat   Dups   999
----------------------------------------------------------------------------------------
 monitoring_checks_9d_seed101.csv       4,672     4,665         70       924      7     1
 monitoring_checks_12d_seed505.csv      6,230     6,220         93     1,229     10     1
 monitoring_checks_14d_seed202.csv      7,269     7,257        109     1,435     12     1
 monitoring_checks_21d_seed303.csv     10,904    10,886        163     2,151     18     1
 monitoring_checks_30d_seed404.csv     15,577    15,552        233     3,095     25     1
========================================================================================
```

### Specific Data Quality Issues Handled

1. **Dual Timestamp Encodings (ISO-8601 vs Unix Epoch)**:
   - _Problem_: Timestamps alternate between ISO-8601 UTC strings (`2025-05-13T12:45:00Z`) and raw Unix epoch seconds (`1746938700`).
   - _Resolution_: Regular expression detection (`/^\d+$/`) checks for pure numeric epoch strings, parses them as seconds via `new Date(sec * 1000)`, and standardizes all records to UTC ISO-8601 timestamps before database persistence.

2. **Heterogeneous Latency Units (`ms` vs `s`)**:
   - _Problem_: Latencies alternate between integer milliseconds (`707`, `ms`) and decimal seconds (`0.717`, `s`).
   - _Resolution_: When `latency_unit === "s"`, the value is converted via `latencyMs = Math.round(raw * 1000 * 100) / 100`. All latencies are stored uniformly in milliseconds (`float` / `real` in Postgres).

3. **Missing / Null Latencies on Network Drops**:
   - _Problem_: Checks resulting in timeouts or dropped connections lack latency values (e.g. `200,,ms,agent-1`).
   - _Resolution_: Null values are preserved as SQL `NULL`. Fabricating `0ms` would severely distort P50/P95 latency percentiles and artificially lower service averages. The UI cleanly presents these as `null (timeout)`.

4. **Synthetic HTTP Status `999` (Agent Connection Dropouts)**:
   - _Problem_: Checks where no HTTP response was received (DNS timeout, socket hangup) are recorded as status `999`.
   - _Resolution_: Classified strictly as downtime outages (`is_success = false`). In contractual SLA enforcement, probe unreachability must penalize availability.

5. **Cross-Agent Duplicate Probe Records**:
   - _Problem_: Redundant rows caused by agent retry storms with identical service, timestamp, and reporting agent.
   - _Resolution_: Deduplication is performed twice for defense-in-depth:
     1. In-memory deduplication in the Lambda cleaner using an idempotency key `serviceId#timestampIso#agent`.
     2. PostgreSQL table constraint: `UNIQUE (service_id, timestamp, agent)` with `ON CONFLICT DO NOTHING` during 1,000-row batch inserts.

6. **Ground Truth Incident Alignment**:
   - All incidents specified in `dataset_incident_log.json` were cross-referenced and verified using `pnpm verify`:
     - **9-Day**: `svc-reports` Day 5 outage (check-points 64-69, ~16:00-17:15 UTC) -> **22 failures isolated**.
     - **12-Day**: `svc-search` Day 4 & Day 8 outages -> **29 failures isolated**.
     - **14-Day**: `svc-notify` Day 0 & Day 6 outages -> **32 failures isolated**.
     - **21-Day**: `svc-payments` Day 2 outage -> **50 failures isolated**.
     - **30-Day**: `svc-auth` Day 16 & `svc-reports` Day 3 outages -> **32 and 86 failures isolated**.

---

## 3. Assumptions & Decision Rationale

### 1. Contractual SLA Threshold & Short-Window Math

- **Rule**: Availability strictly below `99.900%` triggers contractual penalty qualification (`PENALTY TRIGGERED`).
- **Short-Window Reality**: In a 9-day run (864 checks per service at 15-minute intervals), just **1 failure** drops availability to `(863/864) = 99.884%`, breaching the SLA. We evaluate availability strictly over the observed sample window and clearly surface the date bounds and check counts to prevent misleading extrapolations.

### 2. Multi-Agent Redundancy vs Strict Outage Counting

- When multiple agents report during the same 15-minute window, each individual probe record is treated as an independent health check. This avoids masking partial network partition issues visible only from specific agent routes.

### 3. Curated Dashboard Metrics (Why These Matter)

- **For On-Call Engineers**:
  - Fleet Uptime % and Disrupted Probe Counts.
  - Per-service P95 latency and failure code breakdowns (`500`, `502`, `503`, `999`).
  - Searchable status codes to immediately filter for `999` network drops vs `500` server bugs.
- **For Billing & Finance Teams**:
  - Direct **Billing Credit Status** indicator (`PENALTY TRIGGERED` vs `NO CREDIT OWED`).
  - List of qualifying breached services with exact uptime percentages to 3 decimal places.

---

## 4. Local Development & Deployment Guide

### Prerequisites

- Node.js 20+ and `pnpm`
- AWS Account with IAM credentials for S3 and Lambda
- PostgreSQL database (Supabase or Neon)

### Environment Setup

Create a `.env` file in the project root:

```env
DATABASE_URL=postgresql://[user]:[password]@[host]:6543/[database]
AWS_REGION=ap-south-1
AWS_ACCESS_KEY_ID=[your-aws-access-key]
AWS_SECRET_ACCESS_KEY=[your-aws-secret-key]
S3_BUCKET_NAME=sla-logs
AWS_LAMBDA_FUNCTION_NAME=sla-ingestion-worker
AWS_LAMBDA_ROLE_ARN=arn:aws:iam::[account-id]:role/[role-name]
```

### Quick Commands

```bash
# 1. Install dependencies
pnpm install

# 2. Push database schema to PostgreSQL
pnpm db:push

# 3. Deploy/Update AWS Lambda stateless worker & attach S3 triggers
pnpm lambda:deploy

# 4. Start local Next.js development server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) to view the live dashboard.

### Project Directory Structure (WebDevSimplified Feature-Driven Architecture)

```text
sla-monitoring-dashboard/
├── app/                        # Next.js App Router (thin routes, root layout, global styles)
├── components/                 # Shared UI wrappers, Dashboard header & AntD Providers
├── drizzle/                    # Drizzle ORM client, schemas, migrations, relations
├── features/                   # Domain-driven feature slices (WDS pattern)
│   ├── sla-metrics/            # Fleet availability, KPI cards & per-service breakdown
│   │   ├── components/
│   │   ├── schemas/
│   │   ├── actions.ts          # Pure Next.js Server Actions ("use server")
│   │   ├── db.ts               # Drizzle ORM repository (no raw queries)
│   │   └── index.ts
│   ├── logs/                   # Health checks table & multifaceted filter bar
│   │   ├── components/
│   │   ├── schemas/
│   │   ├── actions.ts          # Pure Next.js Server Actions ("use server")
│   │   ├── db.ts               # Drizzle ORM repository (no raw queries)
│   │   └── index.ts
│   └── upload/                 # Ingestion modal, CSV validator & S3 upload
│       ├── components/
│       ├── schemas/
│       ├── actions.ts          # Pure Next.js Server Actions ("use server")
│       ├── db.ts               # Drizzle ORM repository (no raw queries)
│       └── index.ts
├── lambda/                     # Stateless AWS Lambda data normalizer & cleaner
├── lib/                        # Environment validation (zod + t3-oss) & shared types
├── proxy.ts                    # Next.js 16 Proxy: sliding-window rate limiting & security headers
├── services/                   # Cloud integrations (AWS S3 & AWS Lambda clients)
└── scripts/                    # Lambda deployment, database constraints & verification
```

---

## 5. Live Production URL

- **Dashboard UI**: Deployed on Vercel
- **Cloud Functions**: AWS Lambda `sla-ingestion-worker` (`ap-south-1`)
- **Storage**: Amazon S3 `sla-logs`
- **Database**: Supabase PostgreSQL (`aws-1-ap-southeast-2`)

### Live Demo & Verification Walkthrough

1. Open the dashboard.
2. Click **Upload CSV** in the top navigation.
3. Drag-and-drop or browse to select your telemetry CSV file.
4. Watch the progress tracker upload the file to S3, invoke the AWS Lambda worker, normalize the telemetry, and commit the batch to Postgres.
5. Review the updated fleet stats, SLA breach badges, and explore the interactive logs with date range and status code filters.

---

## 6. What We Would Do Differently With More Time

1. **Streaming Postgres COPY Protocol**:
   - For files exceeding 100MB / 1M rows, replace parameterized multi-row `INSERT` statements with Node.js streaming `pg-copy-streams` (`COPY health_checks FROM STDIN WITH CSV`) writing into an unlogged staging table.
2. **Multi-Agent Quorum Consensus**:
   - Implement an outage quorum policy where a service is only penalized if $\ge 2$ independent regional agents report failure within the same 15-minute sampling bucket, preventing single-agent internet routing blips from triggering SLA refunds.
3. **Automated Webhook & Credit Billing Dispatch**:
   - Emit automated webhook payloads to billing gateways (Stripe, Chargebee) or incident management platforms (PagerDuty, Slack) immediately upon monthly SLA breach qualification.
4. **Real-Time Telemetry Streaming**:
   - Connect Server-Sent Events (SSE) or WebSockets from AWS Lambda via AWS SNS/IoT Core to live-stream checks into the dashboard feed as they arrive.
