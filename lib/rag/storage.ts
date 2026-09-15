import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  getAppEnv,
  getAwsRegion,
  getRagLocalDir,
  getRagS3Bucket,
  getRagS3Prefix,
  getRagStorageDriver,
} from "./config";

export function objectKeyFor(fileName: string): string {
  return `${getRagS3Prefix()}/corpus/${fileName}`;
}

export async function putObject(key: string, body: string): Promise<void> {
  if (getRagStorageDriver() === "s3") {
    await putS3(key, body);
    return;
  }
  const full = path.join(getRagLocalDir(), key);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, body, "utf8");
}

export async function getObject(key: string): Promise<string | null> {
  if (getRagStorageDriver() === "s3") {
    return getS3(key);
  }
  try {
    return await readFile(path.join(getRagLocalDir(), key), "utf8");
  } catch {
    return null;
  }
}

async function createS3Client() {
  const { S3Client } = await import("@aws-sdk/client-s3");
  const endpoint = process.env.RAG_S3_ENDPOINT?.trim();
  const accessKeyId = process.env.RAG_S3_ACCESS_KEY?.trim();
  const secretAccessKey = process.env.RAG_S3_SECRET_KEY?.trim();
  return new S3Client({
    region: getAwsRegion(),
    ...(endpoint
      ? {
          endpoint,
          forcePathStyle: true,
        }
      : {}),
    ...(accessKeyId && secretAccessKey
      ? { credentials: { accessKeyId, secretAccessKey } }
      : {}),
  });
}

async function putS3(key: string, body: string): Promise<void> {
  const { PutObjectCommand } = await import("@aws-sdk/client-s3");
  const client = await createS3Client();
  await client.send(
    new PutObjectCommand({
      Bucket: getRagS3Bucket(),
      Key: key,
      Body: body,
      ContentType: "text/markdown; charset=utf-8",
      Metadata: { env: getAppEnv() },
    }),
  );
}

async function getS3(key: string): Promise<string | null> {
  const { GetObjectCommand } = await import("@aws-sdk/client-s3");
  const client = await createS3Client();
  try {
    const out = await client.send(
      new GetObjectCommand({ Bucket: getRagS3Bucket(), Key: key }),
    );
    return (await out.Body?.transformToString()) ?? null;
  } catch {
    return null;
  }
}
