import { describe, it, expect } from "vitest";
import {
  classifySheetName,
  coerceDate,
  coerceInteger,
  findHeaderRowIndex,
  isExcludedRow,
  normalizeSalesRow,
  pickSheetName,
} from "@/lib/analysis/sales";

describe("classifySheetName", () => {
  it("売上・サマリー・その他を分類する", () => {
    expect(classifySheetName("売上データ")).toBe("sales");
    expect(classifySheetName("月次サマリー")).toBe("summary");
    expect(classifySheetName("Sheet1")).toBe("other");
  });
});

describe("pickSheetName", () => {
  it("売上データシートを優先し、月次サマリーは除外対象にする", () => {
    const picked = pickSheetName(
      ["月次サマリー", "売上データ"],
      () => 0,
    );
    expect(picked.sheetName).toBe("売上データ");
    expect(picked.skippedSummarySheets).toEqual(["月次サマリー"]);
  });
});

describe("findHeaderRowIndex", () => {
  it("タイトル行の次にあるヘッダーを見つける", () => {
    const index = findHeaderRowIndex([
      ["売上データ（検証用ダミー）"],
      ["日付", "地域", "営業担当者", "商品カテゴリ", "商品名", "数量", "単価", "売上金額"],
      ["2026-04-01", "東京"],
    ]);
    expect(index).toBe(1);
  });
});

describe("isExcludedRow", () => {
  it("合計行と注記行を除外対象にする", () => {
    expect(isExcludedRow(["合計", null, null, 100])).toBe(true);
    expect(isExcludedRow(["※検証用ダミーデータ"])).toBe(true);
    expect(
      isExcludedRow([
        "2026-04-01",
        "東京",
        "佐藤",
        "コンサルティング",
        "業務プロセス診断",
        1,
        30000,
        30000,
      ]),
    ).toBe(false);
  });
});

describe("coerceDate / coerceInteger", () => {
  it("日付文字列と Excel シリアルを YYYY-MM-DD にする", () => {
    expect(coerceDate("2026-4-1")).toBe("2026-04-01");
    expect(coerceDate("2026/06/30")).toBe("2026-06-30");
    expect(coerceDate(new Date(Date.UTC(2026, 3, 1)))).toBe("2026-04-01");
    expect(coerceDate(46113)).toBe("2026-04-01");
  });

  it("カンマ付き金額を整数にする", () => {
    expect(coerceInteger("1,200,000")).toBe(1_200_000);
    expect(coerceInteger("¥80,000")).toBe(80_000);
    expect(coerceInteger(3)).toBe(3);
  });
});

describe("normalizeSalesRow", () => {
  it("amount 未指定なら quantity × unit_price を格納する", () => {
    const result = normalizeSalesRow(
      {
        date: "2026-04-01",
        region: "東京",
        sales_rep: "佐藤",
        category: "コンサルティング",
        product: "業務プロセス診断",
        quantity: 2,
        unit_price: 300000,
        amount: null,
      },
      2,
    );
    expect(result?.values.amount).toBe(600000);
    expect(result?.warnings).toHaveLength(0);
  });

  it("商品とカテゴリの対応が違う場合はマスタ側に補正する", () => {
    const result = normalizeSalesRow(
      {
        date: "2026-04-01",
        region: "札幌",
        sales_rep: "渡辺",
        category: "ライセンス",
        product: "生成AI導入支援",
        quantity: 1,
        unit_price: 500000,
        amount: 500000,
      },
      5,
    );
    expect(result?.values.category).toBe("コンサルティング");
    expect(result?.warnings.some((w) => w.includes("補正"))).toBe(true);
  });
});
