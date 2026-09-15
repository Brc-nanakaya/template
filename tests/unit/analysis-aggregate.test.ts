import { describe, it, expect } from "vitest";
import { aggregateMonthly } from "@/lib/analysis/aggregate";

describe("aggregateMonthly", () => {
  it("月別の件数・売上合計・平均単価を集計する", () => {
    const rows = [
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
        date: "2026-04-15",
        region: "大阪",
        sales_rep: "鈴木",
        category: "トレーニング",
        product: "AX基礎研修（使う）",
        quantity: 1,
        unit_price: 80000,
        amount: 80000,
      },
      {
        date: "2026-05-02",
        region: "福岡",
        sales_rep: "田中",
        category: "ライセンス",
        product: "Claude Team ライセンス",
        quantity: 3,
        unit_price: 50000,
        amount: 150000,
      },
    ];

    expect(aggregateMonthly(rows)).toEqual([
      {
        month: "2026-04",
        rowCount: 2,
        totalAmount: 680000,
        avgUnitPrice: 226667,
      },
      {
        month: "2026-05",
        rowCount: 1,
        totalAmount: 150000,
        avgUnitPrice: 50000,
      },
    ]);
  });
});
