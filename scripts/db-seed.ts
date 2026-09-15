import { count, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { generateDummySales } from "@/lib/analysis/dummy";
import { SALES_TABLE_NAME } from "@/lib/analysis/schema";
import { hashPassword, normalizeLoginId } from "@/lib/auth/password";
import { connectForScript } from "@/lib/db/env";
import * as schema from "@/lib/db/schema";
import { ingestDemoCorpus } from "@/lib/rag/ingest";
import { datasetRows, datasets, users } from "@/lib/db/schema";

/**
 * デモ用のダミーデータ投入。
 *
 * - 何度実行しても同じ結果になる（既存ユーザーは upsert、データセットは重複投入しない）
 * - パスワードは環境変数で上書きできる。本番デモ環境では必ず上書きすること
 *     SEED_ADMIN_PASSWORD / SEED_MEMBER_PASSWORD
 * - `--force` を付けるとデータセットを作り直す
 */

interface SeedUser {
  loginId: string;
  name: string;
  role: "admin" | "member";
  password: string;
}

const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? "demo1234";
const MEMBER_PASSWORD = process.env.SEED_MEMBER_PASSWORD ?? "demo1234";

const SEED_USERS: SeedUser[] = [
  {
    loginId: "demo@example.com",
    name: "デモ管理者",
    role: "admin",
    password: ADMIN_PASSWORD,
  },
  {
    loginId: "sales1@example.com",
    name: "営業担当 佐藤",
    role: "member",
    password: MEMBER_PASSWORD,
  },
  {
    loginId: "sales2@example.com",
    name: "営業担当 鈴木",
    role: "member",
    password: MEMBER_PASSWORD,
  },
  {
    loginId: "sales3@example.com",
    name: "営業担当 高橋",
    role: "member",
    password: MEMBER_PASSWORD,
  },
];

const DEMO_DATASET_NAME = "デモ売上データ（2026年度）";
const ROW_INSERT_CHUNK = 500;

async function main() {
  const force = process.argv.includes("--force");
  const sql = connectForScript();
  const db = drizzle(sql, { schema });

  try {
    // --- ユーザー ---
    let adminId = "";
    for (const u of SEED_USERS) {
      const loginId = normalizeLoginId(u.loginId);
      const passwordHash = await hashPassword(u.password);
      const [row] = await db
        .insert(users)
        .values({ loginId, name: u.name, role: u.role, passwordHash })
        .onConflictDoUpdate({
          target: users.loginId,
          set: { name: u.name, role: u.role, passwordHash, updatedAt: new Date() },
        })
        .returning({ id: users.id });
      if (u.role === "admin" && row) adminId = row.id;
      console.log(`👤 ${loginId} (${u.role})`);
    }

    // --- デモ売上データセット ---
    const existing = await db
      .select({ id: datasets.id })
      .from(datasets)
      .where(eq(datasets.name, DEMO_DATASET_NAME));

    if (existing.length > 0 && !force) {
      console.log(
        `📊 「${DEMO_DATASET_NAME}」は既に存在するためスキップ（作り直すには --force）`,
      );
    } else {
      if (existing.length > 0) {
        for (const d of existing) {
          await db.delete(datasets).where(eq(datasets.id, d.id));
        }
        console.log("🗑  既存のデモデータセットを削除");
      }

      const parsed = generateDummySales();
      const [head] = await db
        .insert(datasets)
        .values({
          name: DEMO_DATASET_NAME,
          fileName: "demo_sales_2026.xlsx",
          sheetName: parsed.sheetName,
          tableName: SALES_TABLE_NAME,
          columns: parsed.columns,
          rowCount: parsed.rows.length,
          createdBy: adminId || null,
        })
        .returning({ id: datasets.id });

      if (!head) throw new Error("デモデータセットの作成に失敗しました");

      for (let i = 0; i < parsed.rows.length; i += ROW_INSERT_CHUNK) {
        const chunk = parsed.rows
          .slice(i, i + ROW_INSERT_CHUNK)
          .map((values, j) => ({
            datasetId: head.id,
            rowIndex: i + j,
            values,
          }));
        await db.insert(datasetRows).values(chunk);
      }
      console.log(
        `📊 「${DEMO_DATASET_NAME}」を投入（${parsed.rows.length} 行）`,
      );
    }

    const rag = await ingestDemoCorpus({ force });
    console.log(
      `📜 法令 RAG: ${rag.map((r) => `${r.title}(${r.chunkCount}条)`).join(" / ")}`,
    );

    const [userCount] = await db.select({ n: count() }).from(users);
    const [rowTotal] = await db.select({ n: count() }).from(datasetRows);
    console.log(
      `\n✅ シード完了: users=${userCount?.n ?? 0} / dataset_rows=${rowTotal?.n ?? 0}`,
    );
    console.log(
      `   ログイン: demo@example.com / ${ADMIN_PASSWORD}  （SEED_ADMIN_PASSWORD で変更可）`,
    );
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((e) => {
  console.error("❌ シード失敗\n", e);
  process.exit(1);
});
