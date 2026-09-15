import { afterEach, describe, expect, it } from "vitest";
import {
  getAppEnv,
  getAwsRegion,
  getRagLlmProvider,
  getRagRuntimeStatus,
  getRagStorageDriver,
} from "@/lib/rag/config";

const KEYS = ["APP_ENV", "AWS_REGION", "RAG_STORAGE", "RAG_LLM"] as const;

describe("rag config", () => {
  const prev = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));

  afterEach(() => {
    for (const k of KEYS) {
      if (prev[k] === undefined) delete process.env[k];
      else process.env[k] = prev[k];
    }
  });

  it("未設定なら local / 東京 / fs / extractive", () => {
    delete process.env.APP_ENV;
    delete process.env.AWS_REGION;
    delete process.env.RAG_STORAGE;
    delete process.env.RAG_LLM;
    expect(getAppEnv()).toBe("local");
    expect(getAwsRegion()).toBe("ap-northeast-1");
    expect(getRagStorageDriver()).toBe("fs");
    expect(getRagLlmProvider()).toBe("extractive");
  });

  it("demo では既定の保管が s3 になる", () => {
    process.env.APP_ENV = "demo";
    delete process.env.RAG_STORAGE;
    expect(getRagStorageDriver()).toBe("s3");
  });

  it("ローカル状態に確認できる点とできない点を出す", () => {
    process.env.APP_ENV = "local";
    const status = getRagRuntimeStatus();
    expect(status.verifiable.length).toBeGreaterThan(0);
    expect(status.notVerifiable.some((s) => s.includes("Bedrock"))).toBe(true);
  });
});
