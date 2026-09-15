import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { sql as raw } from "drizzle-orm";
import { connectForScript } from "@/lib/db/env";

/**
 * drizzle/ 配下のマイグレーションを適用する。
 * ローカル・AWS RDS・Azure のどこへでも同じコマンドで流せる。
 *
 *   npm run db:migrate
 *   DATABASE_URL='postgres://...' npm run db:migrate
 *
 * ECS の一回限りタスクや Container Apps ジョブから複数同時に起動されても
 * 壊れないよう、PostgreSQL のアドバイザリロックで直列化している。
 */

/** このアプリのマイグレーション専用ロック ID（他アプリと衝突しない任意の定数） */
const LOCK_ID = 728_311_045;

async function main() {
  const sql = connectForScript();
  const db = drizzle(sql);

  try {
    // 先にロックを取る。他のプロセスが流している間はここで待つ
    await db.execute(raw`select pg_advisory_lock(${LOCK_ID})`);
    try {
      await migrate(db, { migrationsFolder: "./drizzle" });
      console.log("✅ マイグレーション完了");
    } finally {
      await db.execute(raw`select pg_advisory_unlock(${LOCK_ID})`);
    }
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((e) => {
  console.error("❌ マイグレーション失敗\n", e);
  process.exit(1);
});
