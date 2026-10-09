// @vitest-environment node
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  deleteDataset,
  getDataset,
  listDatasets,
  replaceAllDatasets,
  saveDataset,
} from "@/lib/analysis/db";
import { closeDb } from "@/lib/db";
import type { ParsedExcel } from "@/lib/analysis/types";
import { isDbAvailable } from "./_db-available";

/**
 * 実際の PostgreSQL に対して往復させる結合テスト。
 * DB が無い環境ではスキップする（`npm run db:up` で起動できる）。
 *
 * テストが作ったデータセットは afterEach で必ず削除するため、
 * シード済みのデモデータには手を付けない。
 */

const sampleParsed: ParsedExcel = {
  sheetName: "売上データ",
  columns: [
    "date",
    "region",
    "sales_rep",
    "category",
    "product",
    "quantity",
    "unit_price",
    "amount",
  ],
  rows: [
    {
      date: "2026-04-01",
      region: "東京",
      sales_rep: "佐藤",
      category: "コンサルティング",
      product: "業務プロセス診断",
      quantity: 2,
      unit_price: 300000,
      amount: 600000,
    },
    {
      date: "2026-05-10",
      region: "大阪",
      sales_rep: "鈴木",
      category: "トレーニング",
      product: "AX基礎研修（使う）",
      quantity: 1,
      unit_price: 80000,
      amount: 80000,
    },
  ],
  warnings: [],
  skippedTotalRows: 0,
};

let dbUp = false;
const created: string[] = [];

beforeAll(async () => {
  dbUp = await isDbAvailable();
  if (!dbUp) {
    console.warn(
      "⚠️  DATABASE_URL に接続できないため analysis db のテストをスキップします（npm run db:up）",
    );
  }
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

/** テスト用データセットを作り、後片付け対象に登録する */
async function createFixture(name: string) {
  const saved = await saveDataset({
    name,
    fileName: "sales.xlsx",
    parsed: sampleParsed,
  });
  created.push(saved.id);
  return saved;
}

describe.runIf(process.env.DATABASE_URL)("analysis db (PostgreSQL)", () => {
  it("save → list → get で往復できる", async () => {
    if (!dbUp) return;
    const saved = await createFixture("__test__ 2026年度1Q");

    expect(saved.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(saved.rowCount).toBe(2);
    expect(saved.tableName).toBe("sales_data");
    expect(saved.rows).toHaveLength(2);

    const list = await listDatasets();
    const listed = list.find((d) => d.id === saved.id);
    expect(listed?.name).toBe("__test__ 2026年度1Q");
    expect(listed).not.toHaveProperty("rows");

    const loaded = await getDataset(saved.id);
    expect(loaded?.rows).toHaveLength(2);
    // 取り込み順が保持される
    expect(loaded?.rows[0]?.values.product).toBe("業務プロセス診断");
    expect(loaded?.rows[1]?.values.product).toBe("AX基礎研修（使う）");
  });

  it("delete で削除できる", async () => {
    if (!dbUp) return;
    const saved = await createFixture("__test__ 削除用");

    expect(await deleteDataset(saved.id)).toBe(true);
    expect(await getDataset(saved.id)).toBeNull();
    // 後片付け対象から外す（既に削除済み）
    created.pop();
  });

  it("存在しない ID の削除・取得は false / null", async () => {
    if (!dbUp) return;
    const missing = "00000000-0000-0000-0000-000000000000";
    expect(await deleteDataset(missing)).toBe(false);
    expect(await getDataset(missing)).toBeNull();
  });

  it("replaceAllDatasets は既存を全て消して 1 件だけにする（終了後に既存データは復元）", async () => {
    if (!dbUp) return;
    // 全件削除するテストなので、シード済みデータを退避して最後に戻す
    const backups = await Promise.all(
      (await listDatasets()).map((d) => getDataset(d.id)),
    );
    try {
      await createFixture("__test__ 入れ替え前A");
      await createFixture("__test__ 入れ替え前B");
      const before = (await listDatasets()).length;

      const { dataset, replacedCount } = await replaceAllDatasets({
        name: "__test__ 入れ替え後",
        fileName: "replace.xlsx",
        parsed: sampleParsed,
      });
      created.push(dataset.id);

      expect(replacedCount).toBe(before);
      const after = await listDatasets();
      expect(after.map((d) => d.id)).toEqual([dataset.id]);
      expect((await getDataset(dataset.id))?.rows).toHaveLength(2);
    } finally {
      for (const b of backups.reverse()) {
        if (!b) continue;
        await saveDataset({
          name: b.name,
          fileName: b.fileName,
          parsed: {
            sheetName: b.sheetName,
            columns: b.columns,
            rows: b.rows.map((r) => r.values),
            warnings: [],
            skippedTotalRows: 0,
          },
        });
      }
    }
  });

  it("replaceAllDatasets は保存に失敗したら既存データを消さない", async () => {
    if (!dbUp) return;
    const existing = await createFixture("__test__ 失敗時に残る");
    const before = (await listDatasets()).length;

    await expect(
      replaceAllDatasets({
        name: "__test__ 失敗",
        fileName: "broken.xlsx",
        // sheet_name は NOT NULL のため INSERT が失敗する
        parsed: { ...sampleParsed, sheetName: null as unknown as string },
      }),
    ).rejects.toThrow();

    expect((await listDatasets()).length).toBe(before);
    expect(await getDataset(existing.id)).not.toBeNull();
  });

  it("uuid 形式でない ID でも例外にならない", async () => {
    if (!dbUp) return;
    expect(await getDataset("not-a-uuid")).toBeNull();
    expect(await deleteDataset("not-a-uuid")).toBe(false);
  });
});
