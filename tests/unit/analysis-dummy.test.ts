import { describe, expect, it } from "vitest";
import { generateDummySales } from "@/lib/analysis/dummy";
import {
  CATEGORIES,
  REGIONS,
  SALES_REPS,
  definedColumnKeys,
  expectedCategoryForProduct,
} from "@/lib/analysis/schema";

describe("analysis/dummy", () => {
  it("同じ seed なら同じデータになる（デモの再現性）", () => {
    const a = generateDummySales({ rows: 30, seed: 42 });
    const b = generateDummySales({ rows: 30, seed: 42 });
    expect(a.rows).toEqual(b.rows);
  });

  it("seed を変えるとデータが変わる", () => {
    const a = generateDummySales({ rows: 30, seed: 1 });
    const b = generateDummySales({ rows: 30, seed: 2 });
    expect(a.rows).not.toEqual(b.rows);
  });

  it("定義済みカラムを全て埋める", () => {
    const { columns, rows } = generateDummySales({ rows: 10 });
    expect(columns).toEqual(definedColumnKeys());
    for (const row of rows) {
      for (const key of columns) {
        expect(row[key]).not.toBeUndefined();
      }
    }
  });

  it("マスタ外の値が混ざらない", () => {
    const { rows } = generateDummySales({ rows: 200 });
    for (const row of rows) {
      expect(REGIONS).toContain(row.region as string);
      expect(SALES_REPS).toContain(row.sales_rep as string);
      expect(CATEGORIES).toContain(row.category as string);
      // 商品とカテゴリの組み合わせがマスタと矛盾しない
      expect(expectedCategoryForProduct(String(row.product))).toBe(row.category);
    }
  });

  it("金額 = 単価 × 数量 が常に成り立つ", () => {
    const { rows } = generateDummySales({ rows: 200 });
    for (const row of rows) {
      const q = row.quantity as number;
      const p = row.unit_price as number;
      expect(q).toBeGreaterThan(0);
      expect(p).toBeGreaterThan(0);
      expect(row.amount).toBe(p * q);
    }
  });

  it("日付は指定期間内に収まり、昇順に並ぶ", () => {
    const { rows } = generateDummySales({
      rows: 120,
      startMonth: "2026-04",
      monthCount: 12,
    });
    const dates = rows.map((r) => String(r.date));
    expect([...dates].sort()).toEqual(dates);
    expect(dates[0]! >= "2026-04-01").toBe(true);
    expect(dates.at(-1)! <= "2027-03-31").toBe(true);
  });

  it("行数を指定できる", () => {
    expect(generateDummySales({ rows: 7 }).rows).toHaveLength(7);
  });
});
