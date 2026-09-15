/**
 * AWS 前提の 3 環境。ローカルだけ製品が違っても、データの型は揃える。
 *
 *   local : Docker Postgres + ローカル FS（または MinIO）+ 抽出型回答
 *   demo  : 東京の App Runner / ECS + RDS + S3 +（任意）Bedrock
 *   prod  : 同じ構成の本番バケット / DB。デモデータと混ぜない
 */

export type AppEnv = "local" | "demo" | "prod";
export type RagStorageDriver = "fs" | "s3";
export type RagLlmProvider = "extractive" | "openai" | "bedrock";

const APP_ENVS: readonly AppEnv[] = ["local", "demo", "prod"];

export function getAppEnv(): AppEnv {
  const raw = (process.env.APP_ENV ?? "local").trim().toLowerCase();
  return (APP_ENVS as string[]).includes(raw) ? (raw as AppEnv) : "local";
}

export function getAwsRegion(): string {
  return process.env.AWS_REGION?.trim() || "ap-northeast-1";
}

export function getRagStorageDriver(): RagStorageDriver {
  const raw = (process.env.RAG_STORAGE ?? "").trim().toLowerCase();
  if (raw === "s3" || raw === "fs") return raw;
  return getAppEnv() === "local" ? "fs" : "s3";
}

export function getRagLlmProvider(): RagLlmProvider {
  const raw = (process.env.RAG_LLM ?? "").trim().toLowerCase();
  if (raw === "bedrock" || raw === "extractive" || raw === "openai") return raw;
  return "extractive";
}

export function getRagS3Bucket(): string {
  return process.env.RAG_S3_BUCKET?.trim() || "rag-local";
}

export function getRagS3Prefix(): string {
  const prefix = process.env.RAG_S3_PREFIX?.trim() || getAppEnv();
  return prefix.replace(/^\/+|\/+$/g, "");
}

export function getRagLocalDir(): string {
  return process.env.RAG_LOCAL_DIR?.trim() || "data/rag/objects";
}

export function getBedrockModelId(): string {
  return (
    process.env.RAG_BEDROCK_MODEL_ID?.trim() ||
    "anthropic.claude-3-5-sonnet-20240620-v1:0"
  );
}

export function getNeo4jUri(): string {
  const raw = process.env.NEO4J_URI?.trim();
  if (raw === "off" || raw === "disable" || process.env.NEO4J_DISABLED === "1") {
    return "";
  }
  if (raw) return raw;
  return getAppEnv() === "local" ? "bolt://localhost:7687" : "";
}

export function getNeo4jAuth(): { user: string; password: string } {
  return {
    user: process.env.NEO4J_USER?.trim() || "neo4j",
    password: process.env.NEO4J_PASSWORD?.trim() || "raglocal",
  };
}

export function getNeo4jBrowserUrl(): string {
  return process.env.NEO4J_BROWSER_URL?.trim() || "http://localhost:7474";
}

export interface RagRuntimeStatus {
  env: AppEnv;
  region: string;
  storage: RagStorageDriver;
  llm: RagLlmProvider;
  bucket: string;
  prefix: string;
  verifiable: string[];
  notVerifiable: string[];
}

export function getRagRuntimeStatus(): RagRuntimeStatus {
  const env = getAppEnv();
  const local = env === "local";
  return {
    env,
    region: getAwsRegion(),
    storage: getRagStorageDriver(),
    llm: getRagLlmProvider(),
    bucket: getRagS3Bucket(),
    prefix: getRagS3Prefix(),
    verifiable: [
      "条・項単位のチャンク境界",
      "条番号での exact 検索",
      "参照・準用の 1 hop",
      "根拠付き回答（引用必須 / 無根拠は棄権）",
      "評価セットによる取り違え検出",
    ],
    notVerifiable: local
      ? [
          "Bedrock 埋め込み・生成の品質",
          "大量 PDF の取込時間",
          "東京リージョンへのデータ所在",
          "S3 バルクロード / VPC / IAM",
          "Neptune（openCypher）の性能。ローカルは Neo4j / Cypher",
        ]
      : [
          "ローカルと完全に同じ埋め込み順位",
          "他環境のバケット・DB を跨いだ一貫性（環境は分ける）",
        ],
  };
}
