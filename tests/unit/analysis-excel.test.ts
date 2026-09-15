import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import {
  isAcceptedExcelFileName,
  parseExcelBuffer,
} from "@/lib/analysis/excel";

const SALES_HEADERS = [
  "日付",
  "地域",
  "営業担当者",
  "商品カテゴリ",
  "商品名",
  "数量",
  "単価",
  "売上金額",
];

function salesLine(overrides?: {
  date?: string | Date | number;
  region?: string;
  sales_rep?: string;
  category?: string;
  product?: string;
  quantity?: number;
  unit_price?: number;
  amount?: number | null;
}): (string | number | Date | null)[] {
  return [
    overrides?.date ?? "2026-04-01",
    overrides?.region ?? "東京",
    overrides?.sales_rep ?? "佐藤",
    overrides?.category ?? "コンサルティング",
    overrides?.product ?? "業務プロセス診断",
    overrides?.quantity ?? 2,
    overrides?.unit_price ?? 300_000,
    overrides?.amount === undefined ? 600_000 : overrides.amount,
  ];
}

function buildWorkbookBuffer(
  sheets: { name: string; rows: (string | number | Date | null)[][] }[],
): Buffer {
  const wb = XLSX.utils.book_new();
  for (const sheet of sheets) {
    const ws = XLSX.utils.aoa_to_sheet(sheet.rows);
    XLSX.utils.book_append_sheet(wb, ws, sheet.name);
  }
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

describe("isAcceptedExcelFileName", () => {
  it("対応拡張子を受け入れる", () => {
    expect(isAcceptedExcelFileName("a.xlsx")).toBe(true);
    expect(isAcceptedExcelFileName("a.XLS")).toBe(true);
    expect(isAcceptedExcelFileName("a.csv")).toBe(true);
  });

  it("非対応拡張子を拒否する", () => {
    expect(isAcceptedExcelFileName("a.pdf")).toBe(false);
    expect(isAcceptedExcelFileName("a.txt")).toBe(false);
  });
});

describe("parseExcelBuffer", () => {
  it("日本語ヘッダーの売上明細をパースする", () => {
    const buffer = buildWorkbookBuffer([
      {
        name: "売上データ",
        rows: [
          SALES_HEADERS,
          salesLine(),
          salesLine({
            date: "2026-05-10",
            region: "大阪",
            sales_rep: "鈴木",
            category: "トレーニング",
            product: "AX基礎研修（使う）",
            quantity: 1,
            unit_price: 80_000,
            amount: 80_000,
          }),
        ],
      },
    ]);

    const parsed = parseExcelBuffer(buffer);
    expect(parsed.sheetName).toBe("売上データ");
    expect(parsed.columns).toEqual([
      "date",
      "region",
      "sales_rep",
      "category",
      "product",
      "quantity",
      "unit_price",
      "amount",
    ]);
    expect(parsed.rows).toHaveLength(2);
    expect(parsed.rows[0]).toMatchObject({
      date: "2026-04-01",
      region: "東京",
      sales_rep: "佐藤",
      product: "業務プロセス診断",
      quantity: 2,
      unit_price: 300_000,
      amount: 600_000,
    });
    expect(parsed.skippedTotalRows).toBe(0);
  });

  it("合計行を除外する", () => {
    const buffer = buildWorkbookBuffer([
      {
        name: "売上データ",
        rows: [
          SALES_HEADERS,
          salesLine(),
          ["合計", null, null, null, null, null, null, 600_000],
        ],
      },
    ]);

    const parsed = parseExcelBuffer(buffer);
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.skippedTotalRows).toBe(1);
    expect(parsed.rows[0]?.region).toBe("東京");
    expect(parsed.warnings.some((w) => w.includes("合計行"))).toBe(true);
  });

  it("月次サマリーシートはスキップして売上シートを取り込む", () => {
    const buffer = buildWorkbookBuffer([
      {
        name: "月次サマリー",
        rows: [
          ["月", "売上合計", "件数", "平均単価"],
          ["2026-04", 600_000, 1, 300_000],
        ],
      },
      {
        name: "売上データ",
        rows: [SALES_HEADERS, salesLine()],
      },
    ]);

    const parsed = parseExcelBuffer(buffer);
    expect(parsed.sheetName).toBe("売上データ");
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.warnings.some((w) => w.includes("月次サマリー"))).toBe(true);
  });

  it("英語ヘッダーでも取り込む", () => {
    const buffer = buildWorkbookBuffer([
      {
        name: "sales_data",
        rows: [
          [
            "date",
            "region",
            "sales_rep",
            "category",
            "product",
            "quantity",
            "unit_price",
            "amount",
          ],
          salesLine({ date: "2026-06-30", region: "福岡" }),
        ],
      },
    ]);

    const parsed = parseExcelBuffer(buffer);
    expect(parsed.rows[0]).toMatchObject({
      date: "2026-06-30",
      region: "福岡",
    });
  });

  it("amount が数量×単価と不一致なら計算値で補正する", () => {
    const buffer = buildWorkbookBuffer([
      {
        name: "売上データ",
        rows: [SALES_HEADERS, salesLine({ amount: 1 })],
      },
    ]);

    const parsed = parseExcelBuffer(buffer);
    expect(parsed.rows[0]?.amount).toBe(600_000);
    expect(parsed.warnings.some((w) => w.includes("不一致"))).toBe(true);
  });

  it("タイトル行があってもヘッダーを検出する", () => {
    const buffer = buildWorkbookBuffer([
      {
        name: "売上データ",
        rows: [
          ["売上データ（検証用ダミー）"],
          SALES_HEADERS,
          salesLine({ region: "名古屋" }),
        ],
      },
    ]);

    const parsed = parseExcelBuffer(buffer);
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.rows[0]?.region).toBe("名古屋");
  });

  it("必須カラムが無いシートはエラーになる", () => {
    const buffer = buildWorkbookBuffer([
      {
        name: "Sheet1",
        rows: [
          ["name", "amount"],
          ["apple", 100],
        ],
      },
    ]);
    expect(() => parseExcelBuffer(buffer)).toThrow(/必須カラムが不足/);
  });

  it("空シートはエラーになる", () => {
    const buffer = buildWorkbookBuffer([{ name: "Sheet1", rows: [] }]);
    expect(() => parseExcelBuffer(buffer)).toThrow(/データがありません/);
  });
});
