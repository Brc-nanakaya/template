import { config } from "dotenv";
import postgres from "postgres";
import { resolveSsl } from "./ssl";

/**
 * Next.js の外（drizzle-kit / スクリプト）から .env.local を読み込む。
 * Next.js のランタイムでは自動で読まれるため、この読み込みは不要。
 */
config({ path: [".env.local", ".env"], quiet: true });

/** DATABASE_URL を必須として取得する（未設定なら分かりやすく落とす） */
export function requireDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      [
        "DATABASE_URL が設定されていません。",
        "  ローカル: cp .env.local.example .env.local && npm run db:setup",
        "  クラウド: DATABASE_URL='postgres://...' npm run db:migrate のように前置きする",
      ].join("\n"),
    );
  }
  return url;
}

/**
 * スクリプト用の単一接続クライアント。
 * TLS 設定はアプリ本体と同じ `resolveSsl()` を使うため、
 * AWS RDS / Azure へもローカルと同じコマンドで流せる。
 */
export function connectForScript() {
  const url = requireDatabaseUrl();
  return postgres(url, {
    max: 1,
    connect_timeout: 15,
    ssl: resolveSsl(url),
    onnotice: () => {},
  });
}
