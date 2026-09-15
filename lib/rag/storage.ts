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

export function objectKeyForUpload(fileName: string): string {
  const safe = fileName.replace(/[^\w.\u3040-\u30ff\u4e00-\u9faf-]+/g, "_");
  return `${getRagS3Prefix()}/uploads/${Date.now()}-${safe}`;
}

export async function putObject(key: string, body: string): Promise<void> {
  await putBinary(key, Buffer.from(body, "utf8"), "text/plain; charset=utf-8");
}

export async function putBinary(
  key: string,
  body: Buffer,
  contentType: string,
): Promise<void> {
  if (getRagStorageDriver() === "s3") {
    await putS3(key, body, contentType);
    return;
  }
  const full = path.join(getRagLocalDir(), key);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, body);
}

export async function getObject(key: string): Promise<string | null> {
  const buf = await getBinary(key);
  return buf ? buf.toString("utf8") : null;
}

export async function getBinary(key: string): Promise<Buffer | null> {
  if (getRagStorageDriver() === "s3") {
    return getS3(key);
  }
  try {
    return await readFile(path.join(getRagLocalDir(), key));
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

async function putS3(
  key: string,
  body: Buffer,
  contentType: string,
): Promise<void> {
  const { PutObjectCommand } = await import("@aws-sdk/client-s3");
  const client = await createS3Client();
  await client.send(
    new PutObjectCommand({
      Bucket: getRagS3Bucket(),
      Key: key,
      Body: body,
      ContentType: contentType,
      Metadata: { env: getAppEnv() },
    }),
  );
}

async function getS3(key: string): Promise<Buffer | null> {
  const { GetObjectCommand } = await import("@aws-sdk/client-s3");
  const client = await createS3Client();
  try {
    const out = await client.send(
      new GetObjectCommand({ Bucket: getRagS3Bucket(), Key: key }),
    );
    const bytes = await out.Body?.transformToByteArray();
    return bytes ? Buffer.from(bytes) : null;
  } catch {
    return null;
  }
}
