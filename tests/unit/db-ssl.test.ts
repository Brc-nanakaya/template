// @vitest-environment node
import { mkdtempSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { isLocalDatabase, resolvePoolMax, resolveSsl } from "@/lib/db/ssl";

/**
 * TLS 設定の解決は本番の安全性に直結するため（require は中間者攻撃を防げない）、
 * 既定値と明示指定の挙動を固定しておく。
 */

const LOCAL = "postgres://app:app@localhost:5434/app";
const RDS =
  "postgres://postgres:pw@demo.abc.ap-northeast-1.rds.amazonaws.com:5432/app";
const AZURE = "postgres://u:pw@demo.postgres.database.azure.com:5432/app";

const PEM = [
  "-----BEGIN CERTIFICATE-----",
  "MIIBdummycertificatecontent",
  "-----END CERTIFICATE-----",
].join("\n");

const KEYS = [
  "DATABASE_SSL",
  "DATABASE_CA_CERT",
  "DATABASE_CA_CERT_PATH",
  "DATABASE_POOL_MAX",
] as const;

let saved: Record<string, string | undefined> = {};

beforeEach(() => {
  saved = {};
  for (const k of KEYS) {
    saved[k] = process.env[k];
    delete process.env[k];
  }
});

afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

describe("db/ssl: isLocalDatabase", () => {
  it("ローカルとコンテナ内のホスト名を判定する", () => {
    expect(isLocalDatabase(LOCAL)).toBe(true);
    expect(isLocalDatabase("postgres://a:b@127.0.0.1:5432/app")).toBe(true);
    expect(isLocalDatabase("postgres://a:b@host.docker.internal:5432/app")).toBe(true);
    // docker compose のサービス名
    expect(isLocalDatabase("postgres://app:app@db:5432/app")).toBe(true);
  });

  it("クラウドのホストはローカル扱いしない", () => {
    expect(isLocalDatabase(RDS)).toBe(false);
    expect(isLocalDatabase(AZURE)).toBe(false);
  });

  it("ホスト名に localhost を含むだけのクラウドホストを誤判定しない", () => {
    expect(isLocalDatabase("postgres://u:p@localhost.example.com:5432/app")).toBe(false);
  });
});

describe("db/ssl: resolveSsl の既定値", () => {
  it("ローカルは TLS 無し", () => {
    expect(resolveSsl(LOCAL)).toBe(false);
  });

  it("クラウドは既定で require（暗号化のみ）", () => {
    expect(resolveSsl(RDS)).toBe("require");
    expect(resolveSsl(AZURE)).toBe("require");
  });
});

describe("db/ssl: resolveSsl の明示指定", () => {
  it("disable / require はそのまま反映される", () => {
    process.env.DATABASE_SSL = "disable";
    expect(resolveSsl(RDS)).toBe(false);

    process.env.DATABASE_SSL = "require";
    expect(resolveSsl(LOCAL)).toBe("require");
  });

  it("大文字・前後空白を許容する", () => {
    process.env.DATABASE_SSL = "  Verify-Full ";
    expect(resolveSsl(RDS)).toBe("verify-full");
  });

  it("verify-full で CA 未指定なら OS 標準の証明書を使う", () => {
    process.env.DATABASE_SSL = "verify-full";
    expect(resolveSsl(RDS)).toBe("verify-full");
  });

  it("verify-full + PEM 直書きで証明書検証を有効にする", () => {
    process.env.DATABASE_SSL = "verify-full";
    process.env.DATABASE_CA_CERT = PEM;
    expect(resolveSsl(RDS)).toEqual({ ca: PEM, rejectUnauthorized: true });
  });

  it("verify-full + base64 の CA も受け付ける", () => {
    process.env.DATABASE_SSL = "verify-full";
    process.env.DATABASE_CA_CERT = Buffer.from(PEM).toString("base64");
    expect(resolveSsl(RDS)).toEqual({ ca: PEM, rejectUnauthorized: true });
  });

  it("verify-full + ファイルパスの CA も受け付ける", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "db-ssl-"));
    const file = path.join(dir, "ca.pem");
    writeFileSync(file, PEM);

    process.env.DATABASE_SSL = "verify-full";
    process.env.DATABASE_CA_CERT_PATH = file;
    expect(resolveSsl(RDS)).toEqual({ ca: PEM, rejectUnauthorized: true });
  });

  it("不正な値は黙って無視せずエラーにする", () => {
    process.env.DATABASE_SSL = "true";
    expect(() => resolveSsl(RDS)).toThrow(/DATABASE_SSL/);
  });

  it("PEM として解釈できない CA はエラーにする", () => {
    process.env.DATABASE_SSL = "verify-full";
    process.env.DATABASE_CA_CERT = "not-a-certificate";
    expect(() => resolveSsl(RDS)).toThrow(/DATABASE_CA_CERT/);
  });

  it("存在しない CA ファイルパスはエラーにする", () => {
    process.env.DATABASE_SSL = "verify-full";
    process.env.DATABASE_CA_CERT_PATH = "/nonexistent/ca.pem";
    expect(() => resolveSsl(RDS)).toThrow(/DATABASE_CA_CERT_PATH/);
  });
});

describe("db/ssl: resolvePoolMax", () => {
  it("既定は 5（常駐コンテナ向け）", () => {
    expect(resolvePoolMax()).toBe(5);
  });

  it("環境変数で上書きできる", () => {
    process.env.DATABASE_POOL_MAX = "1";
    expect(resolvePoolMax()).toBe(1);
  });

  it("不正な値はエラーにする", () => {
    for (const bad of ["0", "-1", "abc", "2.5"]) {
      process.env.DATABASE_POOL_MAX = bad;
      expect(() => resolvePoolMax(), bad).toThrow(/DATABASE_POOL_MAX/);
    }
  });
});
