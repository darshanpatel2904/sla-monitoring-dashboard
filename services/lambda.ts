import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";
import { env } from "@/lib/env";

export const lambdaClient = new LambdaClient({
  region: env.AWS_REGION,
  credentials: {
    accessKeyId: env.AWS_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
  },
});

export interface LambdaIngestionPayload {
  s3Bucket: string;
  s3Key: string;
  filename: string;
}

export interface LambdaIngestionResponse {
  success: boolean;
  batchId?: string;
  totalRows?: number;
  validRows?: number;
  insertedRows?: number;
  duplicateRows?: number;
  stats?: {
    startTime: string;
    endTime: string;
    epochNormalized: number;
    secConverted: number;
    nullLatencies: number;
    status999Count: number;
  };
  durationMs?: number;
  error?: string;
}

export async function invokeDataCleanerLambda(
  payload: LambdaIngestionPayload,
): Promise<LambdaIngestionResponse> {
  const lambdaPayload = {
    Records: [
      {
        s3: {
          bucket: { name: payload.s3Bucket },
          object: { key: payload.s3Key },
        },
      },
    ],
  };

  const invokeCmd = new InvokeCommand({
    FunctionName: env.SLA_AWS_LAMBDA_FUNCTION_NAME,
    InvocationType: "RequestResponse",
    Payload: Buffer.from(JSON.stringify(lambdaPayload)),
  });

  const lambdaRes = await lambdaClient.send(invokeCmd);
  const rawPayload = lambdaRes.Payload
    ? Buffer.from(lambdaRes.Payload).toString("utf-8")
    : "{}";

  if (lambdaRes.FunctionError) {
    throw new Error(
      `AWS Lambda error (${lambdaRes.FunctionError}): ${rawPayload}`,
    );
  }

  const lambdaResponse = JSON.parse(rawPayload);
  const bodyObj =
    typeof lambdaResponse.body === "string"
      ? JSON.parse(lambdaResponse.body)
      : lambdaResponse.body;

  if (lambdaResponse.statusCode && lambdaResponse.statusCode >= 400) {
    throw new Error(
      bodyObj?.message || bodyObj?.error || "AWS Lambda processing failed.",
    );
  }

  const firstResult = bodyObj?.results?.[0];

  return {
    success: true,
    batchId: firstResult?.uploadBatchId,
    totalRows: firstResult?.totalRows || 0,
    validRows: firstResult?.validRows || 0,
    insertedRows: firstResult?.insertedRows || 0,
    duplicateRows: firstResult?.duplicateRows || 0,
    stats: firstResult?.stats,
  };
}
