import postgres from "postgres";
import { resolveSsl } from "@/lib/db/ssl";

/**
 * DB を使うテストは DATABASE_URL に接続できるときだけ実行する。
 * DB を立てていない環境（CI の一部やオフライン）でも `npm test` を通したいため。
 */
export async function isDbAvailable(): Promise<boolean> {
  const url = process.env.DATABASE_URL;
  if (!url) return false;
  const sql = postgres(url, {
    max: 1,
    connect_timeout: 3,
    ssl: resolveSsl(url),
    onnotice: () => {},
  });
  try {
    await sql`select 1`;
    return true;
  } catch {
    return false;
  } finally {
    await sql.end({ timeout: 3 }).catch(() => undefined);
  }
}
