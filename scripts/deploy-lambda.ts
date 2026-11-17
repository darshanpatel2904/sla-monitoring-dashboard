import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as esbuild from "esbuild";
import {
  LambdaClient,
  GetFunctionCommand,
  CreateFunctionCommand,
  UpdateFunctionCodeCommand,
  UpdateFunctionConfigurationCommand,
  AddPermissionCommand,
} from "@aws-sdk/client-lambda";
import {
  S3Client,
  PutBucketNotificationConfigurationCommand,
} from "@aws-sdk/client-s3";
import { env } from "../lib/env";

const credentials = {
  accessKeyId: env.AWS_ACCESS_KEY_ID,
  secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
};

const lambda = new LambdaClient({ region: env.AWS_REGION, credentials });
const s3 = new S3Client({ region: env.AWS_REGION, credentials });

async function buildZip(): Promise<Buffer> {
  const distDir = path.resolve(process.cwd(), "lambda/dist");
  fs.mkdirSync(distDir, { recursive: true });

  const outfile = path.join(distDir, "index.js");
  const zipPath = path.join(distDir, "function.zip");

  await esbuild.build({
    entryPoints: [path.resolve(process.cwd(), "lambda/src/index.ts")],
    bundle: true,
    platform: "node",
    target: "node20",
    format: "cjs",
    outfile,
  });

  if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
  execSync(`zip -j "${zipPath}" "${outfile}"`, { stdio: "ignore" });
  return fs.readFileSync(zipPath);
}

async function waitForActive(name: string) {
  for (let i = 0; i < 15; i++) {
    const res = await lambda.send(new GetFunctionCommand({ FunctionName: name }));
    if (res.Configuration?.State === "Active") return;
    await new Promise((r) => setTimeout(r, 2000));
  }
}

async function deploy() {
  const zipBuffer = await buildZip();
  let functionArn: string;

  try {
    const existing = await lambda.send(
      new GetFunctionCommand({ FunctionName: env.AWS_LAMBDA_FUNCTION_NAME })
    );
    functionArn = existing.Configuration!.FunctionArn!;

    await lambda.send(
      new UpdateFunctionCodeCommand({
        FunctionName: env.AWS_LAMBDA_FUNCTION_NAME,
        ZipFile: zipBuffer,
      })
    );
    await new Promise((r) => setTimeout(r, 3000));
    await lambda.send(
      new UpdateFunctionConfigurationCommand({
        FunctionName: env.AWS_LAMBDA_FUNCTION_NAME,
        Timeout: 30,
        MemorySize: 512,
        Environment: { Variables: { DATABASE_URL: env.DATABASE_URL } },
      })
    );
  } catch (err: any) {
    if (err.name !== "ResourceNotFoundException") throw err;

    const res = await lambda.send(
      new CreateFunctionCommand({
        FunctionName: env.AWS_LAMBDA_FUNCTION_NAME,
        Runtime: "nodejs20.x",
        Role: env.AWS_LAMBDA_ROLE_ARN,
        Handler: "index.handler",
        Code: { ZipFile: zipBuffer },
        Timeout: 30,
        MemorySize: 512,
        Environment: { Variables: { DATABASE_URL: env.DATABASE_URL } },
      })
    );
    functionArn = res.FunctionArn!;
  }

  await waitForActive(env.AWS_LAMBDA_FUNCTION_NAME);

  // Grant S3 invoke permission (ignore if already added)
  try {
    await lambda.send(
      new AddPermissionCommand({
        FunctionName: env.AWS_LAMBDA_FUNCTION_NAME,
        StatementId: "S3InvokeSlaIngestionWorker",
        Action: "lambda:InvokeFunction",
        Principal: "s3.amazonaws.com",
        SourceArn: `arn:aws:s3:::${env.S3_BUCKET_NAME}`,
      })
    );
  } catch (err: any) {
    if (err.name !== "ResourceConflictException") throw err;
  }

  // Set S3 upload notification trigger
  await s3.send(
    new PutBucketNotificationConfigurationCommand({
      Bucket: env.S3_BUCKET_NAME,
      NotificationConfiguration: {
        LambdaFunctionConfigurations: [
          {
            Id: "SlaCsvUploadNotification",
            LambdaFunctionArn: functionArn,
            Events: ["s3:ObjectCreated:*"],
            Filter: {
              Key: { FilterRules: [{ Name: "suffix", Value: ".csv" }] },
            },
          },
        ],
      },
    })
  );

  console.log(`Deployed ${env.AWS_LAMBDA_FUNCTION_NAME} -> S3 trigger active on ${env.S3_BUCKET_NAME}`);
}

deploy().catch((err) => {
  console.error(err);
  process.exit(1);
});
