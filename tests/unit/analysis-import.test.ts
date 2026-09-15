// @vitest-environment node
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { importExcelToDatabase } from "@/lib/analysis/import";
import { deleteDataset, getDataset, listDatasets } from "@/lib/analysis/db";
import { SALES_TABLE_NAME } from "@/lib/analysis/schema";
import { closeDb } from "@/lib/db";
import { isDbAvailable } from "./_db-available";

function buildSalesWorkbook(): Buffer {
  const sheet = XLSX.utils.aoa_to_sheet([
    [
      "日付",
      "地域",
      "営業担当者",
      "商品カテゴリ",
      "商品名",
      "数量",
      "単価",
      "売上金額",
    ],
    [
      "2026-04-01",
      "東京",
      "佐藤",
      "コンサルティング",
      "業務プロセス診断",
      2,
      300_000,
      600_000,
    ],
    [
      "2026-05-15",
      "大阪",
      "鈴木",
      "ライセンス",
      "Claude Team ライセンス",
      3,
      50_000,
      150_000,
    ],
    ["合計", null, null, null, null, null, null, 750_000],
  ]);
  const summary = XLSX.utils.aoa_to_sheet([
    ["月", "売上合計", "件数"],
    ["2026-04", 600_000, 1],
  ]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, "売上データ");
  XLSX.utils.book_append_sheet(wb, summary, "月次サマリー");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

/**
 * PostgreSQL への取り込みまで通す結合テスト。
 * DB が無い環境ではスキップする（`npm run db:up`）。
 */
describe.runIf(process.env.DATABASE_URL)("importExcelToDatabase", () => {
  let dbUp = false;
  const created: string[] = [];

  beforeAll(async () => {
    dbUp = await isDbAvailable();
  });

  afterEach(async () => {
    if (!dbUp) return;
    while (created.length > 0) {
      await deleteDataset(created.pop()!).catch(() => undefined);
    }
  });

  afterAll(async () => {
    if (dbUp) await closeDb();
  });

  it("売上 Excel を取り込んで sales_data に保存する（合計行は除外）", async () => {
    if (!dbUp) return;
    const result = await importExcelToDatabase({
      fileName: "sales.xlsx",
      buffer: buildSalesWorkbook(),
      name: "__test__ 2026年度1Q",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    created.push(result.dataset.id);

    expect(result.dataset.name).toBe("__test__ 2026年度1Q");
    expect(result.dataset.rowCount).toBe(2);
    expect(result.dataset.tableName).toBe(SALES_TABLE_NAME);
    expect(result.warnings.some((w) => w.includes("合計行"))).toBe(true);

    const list = await listDatasets();
    expect(list.some((d) => d.id === result.dataset.id)).toBe(true);

    const detail = await getDataset(result.dataset.id);
    expect(detail?.rows).toHaveLength(2);
    expect(detail?.rows[0]?.values.product).toBe("業務プロセス診断");
    expect(detail?.rows.map((r) => r.values.region)).not.toContain("合計");
  });

  it("非対応拡張子はエラー", async () => {
    if (!dbUp) return;
    const result = await importExcelToDatabase({
      fileName: "note.txt",
      buffer: Buffer.from("hello"),
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(400);
  });
});
