import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import { resolvePoolMax, resolveSsl } from "./ssl";

/**
 * DB クライアント（postgres-js + Drizzle）。
 *
 * ローカル（Docker Postgres）とクラウド（AWS RDS / Azure Database for PostgreSQL）で
 * DATABASE_URL を差し替えるだけでよい単一コードパス。
 *
 * - 接続は遅延生成し、開発サーバーの HMR では globalThis にキャッシュして
 *   コネクションが増え続けるのを防ぐ
 * - TLS と接続数の方針は `lib/db/ssl.ts` に集約している
 */

export type Database = PostgresJsDatabase<typeof schema>;

interface DbCache {
  sql?: ReturnType<typeof postgres>;
  db?: Database;
}

const cache = globalThis as unknown as { __dbCache?: DbCache };
cache.__dbCache ??= {};

function createClient(url: string) {
  return postgres(url, {
    max: resolvePoolMax(),
    // アイドル接続を切って RDS / Azure 側の接続枠を空ける
    idle_timeout: 20,
    connect_timeout: 10,
    ssl: resolveSsl(url),
    onnotice: () => {},
  });
}

/** 生の postgres-js クライアント（トランザクションや raw SQL 用） */
export function getSql() {
  const c = cache.__dbCache!;
  if (!c.sql) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error(
        "DATABASE_URL が未設定です。.env.local を作成し `npm run db:setup` を実行してください。",
      );
    }
    c.sql = createClient(url);
  }
  return c.sql;
}

/** Drizzle のクエリビルダ。アプリコードからはこれを使う */
export function getDb(): Database {
  const c = cache.__dbCache!;
  if (!c.db) {
    c.db = drizzle(getSql(), { schema, logger: false });
  }
  return c.db;
}

/** DB へ到達できるかの簡易チェック（/api/health 用） */
export async function pingDb(): Promise<boolean> {
  const sql = getSql();
  await sql`select 1`;
  return true;
}

/** スクリプト用: 接続を閉じる */
export async function closeDb(): Promise<void> {
  const c = cache.__dbCache!;
  if (c.sql) {
    await c.sql.end({ timeout: 5 });
    c.sql = undefined;
    c.db = undefined;
  }
}

export { schema };
