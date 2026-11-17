import {
  pgTable,
  uuid,
  varchar,
  integer,
  smallint,
  bigserial,
  real,
  boolean,
  timestamp,
  unique,
  index,
} from "drizzle-orm/pg-core";

export const uploadBatches = pgTable("upload_batches", {
  id: uuid("id").primaryKey().defaultRandom(),
  filename: varchar("filename", { length: 255 }).notNull(),
  s3Key: varchar("s3_key", { length: 512 }),
  totalRows: integer("total_rows").notNull().default(0),
  validRows: integer("valid_rows").notNull().default(0),
  startTime: timestamp("start_time", { withTimezone: true, mode: "date" }),
  endTime: timestamp("end_time", { withTimezone: true, mode: "date" }),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow(),
});

export const healthChecks = pgTable(
  "health_checks",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    serviceId: varchar("service_id", { length: 64 }).notNull(),
    serviceName: varchar("service_name", { length: 64 }).notNull(),
    timestamp: timestamp("timestamp", { withTimezone: true, mode: "date" }).notNull(),
    statusCode: smallint("status_code").notNull(),
    latencyMs: real("latency_ms"),
    agent: varchar("agent", { length: 32 }).notNull(),
    region: varchar("region", { length: 32 }).notNull(),
    isSuccess: boolean("is_success").notNull(),
    uploadBatchId: uuid("upload_batch_id").references(() => uploadBatches.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("uq_check_service_timestamp_agent").on(
      table.serviceId,
      table.timestamp,
      table.agent
    ),
    index("idx_health_checks_timestamp").on(table.timestamp.desc()),
    index("idx_health_checks_service_timestamp").on(
      table.serviceId,
      table.timestamp.desc()
    ),
    index("idx_health_checks_failure").on(
      table.isSuccess,
      table.timestamp.desc()
    ),
    index("idx_health_checks_batch").on(table.uploadBatchId),
  ]
);

export type UploadBatch = typeof uploadBatches.$inferSelect;
export type NewUploadBatch = typeof uploadBatches.$inferInsert;

export type HealthCheck = typeof healthChecks.$inferSelect;
export type NewHealthCheck = typeof healthChecks.$inferInsert;
