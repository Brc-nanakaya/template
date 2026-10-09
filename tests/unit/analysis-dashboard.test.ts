import { describe, it, expect } from "vitest";
import { buildSalesDashboard } from "@/lib/analysis/dashboard";

function row(
  date: string,
  region: string,
  salesRep: string,
  category: string,
  product: string,
  quantity: number,
  unitPrice: number,
) {
  return {
    date,
    region,
    sales_rep: salesRep,
    category,
    product,
    quantity,
    unit_price: unitPrice,
    amount: quantity * unitPrice,
  };
}

const rows = [
  row("2026-04-01", "東京", "佐藤", "コンサルティング", "業務プロセス診断", 2, 300000),
  row("2026-04-15", "大阪", "鈴木", "トレーニング", "AX基礎研修（使う）", 1, 80000),
  row("2026-05-02", "東京", "田中", "ライセンス", "Claude Team ライセンス", 3, 50000),
  row("2026-05-20", "福岡", "佐藤", "コンサルティング", "業務プロセス診断", 1, 300000),
];

describe("buildSalesDashboard", () => {
  it("KPI（合計・平均・期間・前月比）を集計する", () => {
    const { kpis } = buildSalesDashboard(rows);
    expect(kpis).toEqual({
      totalAmount: 1130000,
      totalQuantity: 7,
      rowCount: 4,
      avgUnitPrice: 161429,
      avgAmountPerRow: 282500,
      // 4月 680,000 → 5月 450,000
      latestMonthChangePct: ((450000 - 680000) / 680000) * 100,
      latestMonth: "2026-05",
      periodStart: "2026-04-01",
      periodEnd: "2026-05-20",
    });
  });

  it("地域・担当者・カテゴリ別に売上の大きい順で並べ、構成比を付ける", () => {
    const dashboard = buildSalesDashboard(rows);
    expect(dashboard.byRegion.map((r) => [r.label, r.amount])).toEqual([
      ["東京", 750000],
      ["福岡", 300000],
      ["大阪", 80000],
    ]);
    expect(dashboard.bySalesRep[0]).toMatchObject({ label: "佐藤", amount: 900000, quantity: 3 });
    const shareSum = dashboard.byCategory.reduce((s, r) => s + r.share, 0);
    expect(shareSum).toBeCloseTo(100);
  });

  it("上位商品は件数を絞れる", () => {
    const { topProducts } = buildSalesDashboard(rows, { topProducts: 1 });
    expect(topProducts).toHaveLength(1);
    expect(topProducts[0]?.label).toBe("業務プロセス診断");
  });

  it("売上として解釈できない行は除外し、1 か月分しかなければ前月比は null", () => {
    const { kpis } = buildSalesDashboard([
      rows[0]!,
      { date: "2026-04-03", region: "東京", phone: "03-0000-0001" },
    ]);
    expect(kpis.rowCount).toBe(1);
    expect(kpis.latestMonthChangePct).toBeNull();
  });

  it("空データでもゼロ値で返す", () => {
    const dashboard = buildSalesDashboard([]);
    expect(dashboard.kpis.totalAmount).toBe(0);
    expect(dashboard.kpis.periodStart).toBeNull();
    expect(dashboard.monthly).toEqual([]);
  });
});
